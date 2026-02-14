import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { asArray, clone } from "./utils.js";
import type {
  ContextAdaptation,
  ContextResolution,
  DimensionValue,
  ExtendsDiagnostics,
  ExtendsResult,
  PersonalityProfile
} from "./types.js";

const SAFETY_ADAPTATION_NAME = /(crisis|emergency|harm|suicid|self[-_ ]?harm)/i;
type GenericObject = Record<string, unknown>;
type ContextWithPriority = ContextAdaptation & { _index: number; _priority: number };

function dedupExact<T>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = String(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function dedupCaseInsensitive(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = String(item).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function mergeMeta(
  parentMeta: GenericObject = {},
  childMeta: GenericObject = {}
): PersonalityProfile["meta"] {
  const merged = { ...parentMeta, ...childMeta };
  const parentTags = asArray<string>(parentMeta.tags);
  const childTags = asArray<string>(childMeta.tags);
  if (parentTags.length || childTags.length) {
    merged.tags = dedupCaseInsensitive([...parentTags, ...childTags]);
  }
  return merged as PersonalityProfile["meta"];
}

function mergeIdentity(
  parentIdentity: GenericObject = {},
  childIdentity: GenericObject = {}
): PersonalityProfile["identity"] {
  return { ...parentIdentity, ...childIdentity } as PersonalityProfile["identity"];
}

function mergeVoice(
  parentVoice: GenericObject = {},
  childVoice: GenericObject = {}
): PersonalityProfile["voice"] {
  // Dimension-level replace: if child sets a dimension, it replaces the whole dimension value.
  return { ...parentVoice, ...childVoice } as PersonalityProfile["voice"];
}

function mergeVocabulary(
  parentVocab: unknown = {},
  childVocab: unknown = {}
): NonNullable<PersonalityProfile["vocabulary"]> {
  const parent = (parentVocab ?? {}) as GenericObject;
  const child = (childVocab ?? {}) as GenericObject;
  const merged = { ...parent, ...child };
  const mergedPreferred = dedupCaseInsensitive([
    ...asArray<string>(parent.preferred_terms),
    ...asArray<string>(child.preferred_terms)
  ]);
  const mergedForbidden = dedupCaseInsensitive([
    ...asArray<string>(parent.forbidden_terms),
    ...asArray<string>(child.forbidden_terms)
  ]);

  if (mergedPreferred.length) merged.preferred_terms = mergedPreferred;
  if (mergedForbidden.length) merged.forbidden_terms = mergedForbidden;
  return merged as NonNullable<PersonalityProfile["vocabulary"]>;
}

function mergeBehavioralRules(parentRules: unknown = [], childRules: unknown = []): string[] {
  return dedupExact([...asArray<string>(parentRules), ...asArray<string>(childRules)]);
}

function mergeContextAdaptations(
  parentAdaptations: unknown = [],
  childAdaptations: unknown = []
): ContextAdaptation[] {
  const base = asArray<ContextAdaptation>(parentAdaptations).map((item) => clone(item));
  const replacement = asArray<ContextAdaptation>(childAdaptations);

  const byWhen = new Map<string, { item: ContextAdaptation; idx: number }>();
  base.forEach((item, idx) => {
    if (item?.when) {
      byWhen.set(item.when, { item, idx });
    }
  });

  const out = [...base];
  for (const next of replacement) {
    const whenKey = next?.when;
    if (whenKey && byWhen.has(whenKey)) {
      const slot = byWhen.get(whenKey);
      if (!slot) continue;
      out[slot.idx] = clone(next);
      continue;
    }
    out.push(clone(next));
  }
  return out;
}

function removeCaseInsensitive(items: unknown, removals: unknown): string[] {
  const removalSet = new Set(
    asArray<string>(removals).map((item) => String(item).toLowerCase())
  );
  return asArray<string>(items).filter((item) => !removalSet.has(String(item).toLowerCase()));
}

function applyExplicitRemovals(
  parentProfile: PersonalityProfile,
  childProfile: PersonalityProfile,
  mergedProfile: PersonalityProfile,
  diagnostics: ExtendsDiagnostics
): void {
  const childBehavioralRemovals = asArray<string>(childProfile.behavioral_rules_remove);
  const childForbiddenRemovals = asArray<string>(
    childProfile?.vocabulary?.forbidden_terms_remove
  );
  const childPreferredRemovals = asArray<string>(
    childProfile?.vocabulary?.preferred_terms_remove
  );
  const childAdaptationRemovals = asArray<string>(childProfile.context_adaptations_remove);

  if (childBehavioralRemovals.length) {
    diagnostics.warnings.push({
      code: "S006",
      severity: "warning",
      message:
        "Explicit behavioral_rules_remove detected. Behavioral rules are safety-relevant."
    });
    mergedProfile.behavioral_rules = asArray<string>(mergedProfile.behavioral_rules).filter(
      (rule) => !childBehavioralRemovals.includes(rule)
    );
  }

  if (childForbiddenRemovals.length) {
    diagnostics.warnings.push({
      code: "S006",
      severity: "warning",
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
    const removalSet = new Set<string>(childAdaptationRemovals);
    mergedProfile.context_adaptations = asArray<ContextAdaptation>(
      mergedProfile.context_adaptations
    ).filter(
      (adaptation) => !removalSet.has(adaptation?.when)
    );
  }

  const parentBehavioralCount = asArray<string>(parentProfile.behavioral_rules).length;
  const parentForbiddenCount = asArray<string>(parentProfile?.vocabulary?.forbidden_terms).length;
  const mergedBehavioralCount = asArray<string>(mergedProfile.behavioral_rules).length;
  const mergedForbiddenCount = asArray<string>(mergedProfile?.vocabulary?.forbidden_terms).length;

  if (mergedBehavioralCount < parentBehavioralCount || mergedForbiddenCount < parentForbiddenCount) {
    diagnostics.errors.push({
      code: "S006",
      severity: "error",
      message:
        "Merged profile has fewer safety constraints than parent profile."
    });
  }
}

function checkS007SafetyPriority(
  profile: PersonalityProfile,
  diagnostics: ExtendsDiagnostics
): void {
  for (const adaptation of asArray<ContextAdaptation>(profile.context_adaptations)) {
    if (!SAFETY_ADAPTATION_NAME.test(String(adaptation?.when ?? ""))) continue;
    const priority = Number(adaptation?.priority ?? 0);
    if (priority >= 100) continue;
    diagnostics.warnings.push({
      code: "S007",
      severity: "warning",
      message: `Safety adaptation "${adaptation.when}" should set priority: 100.`
    });
  }
}

export function loadProfileFile(filePath: string): PersonalityProfile {
  const raw = fs.readFileSync(filePath, "utf8");
  return parseYaml(raw) as PersonalityProfile;
}

function resolveParentPath(
  profilePath: string,
  extendsName: string,
  options: { bundledProfilesDir?: string } = {}
): string | null {
  const localCandidate = path.join(path.dirname(profilePath), `${extendsName}.yaml`);
  if (fs.existsSync(localCandidate)) return localCandidate;

  const bundledDir =
    options.bundledProfilesDir ?? path.resolve(path.dirname(profilePath), "..");
  const bundledCandidate = path.join(bundledDir, `${extendsName}.yaml`);
  if (fs.existsSync(bundledCandidate)) return bundledCandidate;

  return null;
}

function mergeProfiles(
  parentProfile: PersonalityProfile,
  childProfile: PersonalityProfile,
  diagnostics: ExtendsDiagnostics
): PersonalityProfile {
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

export function resolveExtends(
  profilePath: string,
  options: { bundledProfilesDir?: string } = {}
): ExtendsResult {
  const diagnostics: ExtendsDiagnostics = { warnings: [], errors: [] };
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
      severity: "error",
      message: `Unable to resolve parent profile "${childProfile.extends}".`
    });
    return { profile: childProfile, parentPath: null, diagnostics };
  }

  const parentProfile = loadProfileFile(parentPath);
  if (parentProfile?.extends) {
    diagnostics.errors.push({
      code: "E_EXTENDS_CHAIN",
      severity: "error",
      message: "extends chains are not supported in MVP."
    });
    return { profile: childProfile, parentPath, diagnostics };
  }

  const merged = mergeProfiles(parentProfile, childProfile, diagnostics);
  delete merged.extends;
  return { profile: merged, parentPath, diagnostics };
}

export function normalizeProfile(
  profilePath: string,
  options: { bundledProfilesDir?: string } = {}
): PersonalityProfile {
  return resolveExtends(profilePath, options).profile;
}

export function resolveActiveContext(
  profile: PersonalityProfile,
  context: Record<string, unknown> = {}
): ContextResolution {
  const contextAdaptations = asArray<ContextAdaptation>(profile.context_adaptations).map(
    (adaptation, index) => ({
    ...adaptation,
    _index: index,
    _priority: Number(adaptation?.priority ?? 0)
    })
  ) as ContextWithPriority[];

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

  const resolvedAdjustments: Record<string, DimensionValue> = {};
  const collectedInject: string[] = [];
  for (const adaptation of ordered) {
    for (const [dimension, value] of Object.entries(adaptation.adjustments ?? {})) {
      resolvedAdjustments[dimension] = value as DimensionValue;
    }
    for (const rule of asArray<string>(adaptation.inject)) {
      collectedInject.push(rule);
    }
  }

  return {
    matched: ordered.map(({ _index, _priority, ...rest }) => rest),
    resolvedAdjustments,
    injectRules: collectedInject
  };
}
