import { asArray, clone } from "../utils.js";
import type {
  ContextAdaptation,
  PersonalityProfile
} from "../types.js";
import { type GenericObject } from "./types.js";

const PASS_THROUGH_FIELDS = new Set([
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
]);

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
  childProfile: PersonalityProfile,
  mergedProfile: PersonalityProfile
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
    mergedProfile.behavioral_rules = asArray<string>(mergedProfile.behavioral_rules).filter(
      (rule) => !childBehavioralRemovals.includes(rule)
    );
  }

  if (childForbiddenRemovals.length) {
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
    ).filter((adaptation) => !removalSet.has(adaptation?.when));
  }
}

export function mergeProfiles(
  parentProfile: PersonalityProfile,
  childProfile: PersonalityProfile
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
    if (PASS_THROUGH_FIELDS.has(key)) {
      continue;
    }
    merged[key] = clone(value);
  }

  applyExplicitRemovals(childProfile, merged);
  return merged;
}
