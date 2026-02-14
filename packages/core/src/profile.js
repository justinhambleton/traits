import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

const SAFETY_ADAPTATION_NAME = /(crisis|emergency|harm|suicid|self[-_ ]?harm)/i;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function asArray(value) {
  if (!Array.isArray(value)) return [];
  return value;
}

function dedupExact(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = String(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function dedupCaseInsensitive(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = String(item).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function mergeMeta(parentMeta = {}, childMeta = {}) {
  const merged = { ...parentMeta, ...childMeta };
  const parentTags = asArray(parentMeta.tags);
  const childTags = asArray(childMeta.tags);
  if (parentTags.length || childTags.length) {
    merged.tags = dedupCaseInsensitive([...parentTags, ...childTags]);
  }
  return merged;
}

function mergeIdentity(parentIdentity = {}, childIdentity = {}) {
  return { ...parentIdentity, ...childIdentity };
}

function mergeVoice(parentVoice = {}, childVoice = {}) {
  // Dimension-level replace: if child sets a dimension, it replaces the whole dimension value.
  return { ...parentVoice, ...childVoice };
}

function mergeVocabulary(parentVocab = {}, childVocab = {}) {
  const merged = { ...parentVocab, ...childVocab };
  const mergedPreferred = dedupCaseInsensitive([
    ...asArray(parentVocab.preferred_terms),
    ...asArray(childVocab.preferred_terms)
  ]);
  const mergedForbidden = dedupCaseInsensitive([
    ...asArray(parentVocab.forbidden_terms),
    ...asArray(childVocab.forbidden_terms)
  ]);

  if (mergedPreferred.length) merged.preferred_terms = mergedPreferred;
  if (mergedForbidden.length) merged.forbidden_terms = mergedForbidden;
  return merged;
}

function mergeBehavioralRules(parentRules = [], childRules = []) {
  return dedupExact([...asArray(parentRules), ...asArray(childRules)]);
}

function mergeContextAdaptations(parentAdaptations = [], childAdaptations = []) {
  const base = asArray(parentAdaptations).map((item) => clone(item));
  const replacement = asArray(childAdaptations);

  const byWhen = new Map();
  base.forEach((item, idx) => {
    byWhen.set(item?.when, { item, idx });
  });

  const out = [...base];
  for (const next of replacement) {
    const whenKey = next?.when;
    if (whenKey && byWhen.has(whenKey)) {
      const slot = byWhen.get(whenKey);
      out[slot.idx] = clone(next);
      continue;
    }
    out.push(clone(next));
  }
  return out;
}

function removeCaseInsensitive(items, removals) {
  const removalSet = new Set(asArray(removals).map((item) => String(item).toLowerCase()));
  return asArray(items).filter((item) => !removalSet.has(String(item).toLowerCase()));
}

function applyExplicitRemovals(parentProfile, childProfile, mergedProfile, diagnostics) {
  const childBehavioralRemovals = asArray(childProfile.behavioral_rules_remove);
  const childForbiddenRemovals = asArray(
    childProfile?.vocabulary?.forbidden_terms_remove
  );
  const childPreferredRemovals = asArray(
    childProfile?.vocabulary?.preferred_terms_remove
  );
  const childAdaptationRemovals = asArray(childProfile.context_adaptations_remove);

  if (childBehavioralRemovals.length) {
    diagnostics.warnings.push({
      code: "S006",
      message:
        "Explicit behavioral_rules_remove detected. Behavioral rules are safety-relevant."
    });
    mergedProfile.behavioral_rules = asArray(mergedProfile.behavioral_rules).filter(
      (rule) => !childBehavioralRemovals.includes(rule)
    );
  }

  if (childForbiddenRemovals.length) {
    diagnostics.warnings.push({
      code: "S006",
      message:
        "Explicit vocabulary.forbidden_terms_remove detected. Forbidden terms are safety-relevant."
    });
    const nextForbidden = removeCaseInsensitive(
      mergedProfile?.vocabulary?.forbidden_terms,
      childForbiddenRemovals
    );
    mergedProfile.vocabulary = mergedProfile.vocabulary ?? {};
    mergedProfile.vocabulary.forbidden_terms = nextForbidden;
  }

  if (childPreferredRemovals.length) {
    const nextPreferred = removeCaseInsensitive(
      mergedProfile?.vocabulary?.preferred_terms,
      childPreferredRemovals
    );
    mergedProfile.vocabulary = mergedProfile.vocabulary ?? {};
    mergedProfile.vocabulary.preferred_terms = nextPreferred;
  }

  if (childAdaptationRemovals.length) {
    const removalSet = new Set(childAdaptationRemovals);
    mergedProfile.context_adaptations = asArray(mergedProfile.context_adaptations).filter(
      (adaptation) => !removalSet.has(adaptation?.when)
    );
  }

  const parentBehavioralCount = asArray(parentProfile.behavioral_rules).length;
  const parentForbiddenCount = asArray(parentProfile?.vocabulary?.forbidden_terms).length;
  const mergedBehavioralCount = asArray(mergedProfile.behavioral_rules).length;
  const mergedForbiddenCount = asArray(mergedProfile?.vocabulary?.forbidden_terms).length;

  if (mergedBehavioralCount < parentBehavioralCount || mergedForbiddenCount < parentForbiddenCount) {
    diagnostics.errors.push({
      code: "S006",
      message:
        "Merged profile has fewer safety constraints than parent profile."
    });
  }
}

function checkS007SafetyPriority(profile, diagnostics) {
  for (const adaptation of asArray(profile.context_adaptations)) {
    if (!SAFETY_ADAPTATION_NAME.test(String(adaptation?.when ?? ""))) continue;
    const priority = Number(adaptation?.priority ?? 0);
    if (priority >= 100) continue;
    diagnostics.warnings.push({
      code: "S007",
      message: `Safety adaptation "${adaptation.when}" should set priority: 100.`
    });
  }
}

export function loadProfileFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return parseYaml(raw);
}

function resolveParentPath(profilePath, extendsName, options = {}) {
  const localCandidate = path.join(path.dirname(profilePath), `${extendsName}.yaml`);
  if (fs.existsSync(localCandidate)) return localCandidate;

  const bundledDir =
    options.bundledProfilesDir ?? path.resolve(path.dirname(profilePath), "..");
  const bundledCandidate = path.join(bundledDir, `${extendsName}.yaml`);
  if (fs.existsSync(bundledCandidate)) return bundledCandidate;

  return null;
}

function mergeProfiles(parentProfile, childProfile, diagnostics) {
  const merged = clone(parentProfile);

  // Keep child schema/meta identity and explicit fields where relevant.
  merged.schema = childProfile.schema ?? parentProfile.schema;
  merged.meta = mergeMeta(parentProfile.meta, childProfile.meta);
  merged.identity = mergeIdentity(parentProfile.identity, childProfile.identity);
  merged.voice = mergeVoice(parentProfile.voice, childProfile.voice);
  merged.vocabulary = mergeVocabulary(parentProfile.vocabulary, childProfile.vocabulary);
  merged.behavioral_rules = mergeBehavioralRules(
    parentProfile.behavioral_rules,
    childProfile.behavioral_rules
  );
  merged.context_adaptations = mergeContextAdaptations(
    parentProfile.context_adaptations,
    childProfile.context_adaptations
  );

  // Preserve additional child fields not explicitly merged above.
  for (const [key, value] of Object.entries(childProfile)) {
    if (
      [
        "schema",
        "meta",
        "identity",
        "voice",
        "vocabulary",
        "behavioral_rules",
        "context_adaptations",
        "extends",
        "behavioral_rules_remove",
        "context_adaptations_remove"
      ].includes(key)
    ) {
      continue;
    }
    merged[key] = clone(value);
  }

  applyExplicitRemovals(parentProfile, childProfile, merged, diagnostics);
  checkS007SafetyPriority(merged, diagnostics);
  return merged;
}

export function resolveExtends(profilePath, options = {}) {
  const diagnostics = { warnings: [], errors: [] };
  const childProfile = loadProfileFile(profilePath);

  if (!childProfile?.extends) {
    checkS007SafetyPriority(childProfile, diagnostics);
    return {
      profile: childProfile,
      parentPath: null,
      diagnostics
    };
  }

  const parentPath = resolveParentPath(profilePath, childProfile.extends, options);
  if (!parentPath) {
    diagnostics.errors.push({
      code: "E_RESOLVE_EXTENDS",
      message: `Unable to resolve parent profile "${childProfile.extends}".`
    });
    return { profile: childProfile, parentPath: null, diagnostics };
  }

  const parentProfile = loadProfileFile(parentPath);
  if (parentProfile?.extends) {
    diagnostics.errors.push({
      code: "E_EXTENDS_CHAIN",
      message: "extends chains are not supported in MVP."
    });
    return { profile: childProfile, parentPath, diagnostics };
  }

  const merged = mergeProfiles(parentProfile, childProfile, diagnostics);
  delete merged.extends;
  return { profile: merged, parentPath, diagnostics };
}

export function normalizeProfile(profilePath, options = {}) {
  return resolveExtends(profilePath, options).profile;
}

export function resolveActiveContext(profile, context = {}) {
  const contextAdaptations = asArray(profile.context_adaptations).map((adaptation, index) => ({
    ...adaptation,
    _index: index,
    _priority: Number(adaptation?.priority ?? 0)
  }));

  const active = contextAdaptations.filter((adaptation) => {
    const whenKey = adaptation?.when;
    if (!whenKey) return false;
    return Boolean(context[whenKey]);
  });

  // Semantics: higher priority wins; within equal priority, later array items win.
  const ordered = active.sort((a, b) => {
    if (a._priority !== b._priority) return a._priority - b._priority;
    return a._index - b._index;
  });

  const resolvedAdjustments = {};
  const collectedInject = [];
  for (const adaptation of ordered) {
    for (const [dimension, value] of Object.entries(adaptation.adjustments ?? {})) {
      resolvedAdjustments[dimension] = value;
    }
    for (const rule of asArray(adaptation.inject)) {
      collectedInject.push(rule);
    }
  }

  return {
    matched: ordered.map(({ _index, _priority, ...rest }) => rest),
    resolvedAdjustments,
    injectRules: collectedInject
  };
}
