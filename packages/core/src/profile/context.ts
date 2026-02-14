import { asArray } from "../utils.js";
import type {
  ContextAdaptation,
  ContextResolution,
  DimensionValue,
  PersonalityProfile
} from "../types.js";
import type { ContextWithPriority } from "./types.js";

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
