import { DIMENSIONS, LEVEL_INDEX } from "../utils.js";
import type {
  ContextAdaptation,
  DimensionName,
  PersonalityProfile,
  Level
} from "../types.js";

type EnvelopeDimension = {
  target: Level;
  floor: Level;
  ceiling: Level;
  adapt: boolean;
};

export type S002Envelope = Record<DimensionName, EnvelopeDimension | null>;

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asLevel(value: unknown): Level | null {
  if (typeof value !== "string") return null;
  if (!LEVEL_INDEX.has(value as Level)) return null;
  return value as Level;
}

function normalizeDimension(raw: unknown): EnvelopeDimension | null {
  if (typeof raw === "string") {
    const target = asLevel(raw);
    if (!target) return null;
    return { target, floor: target, ceiling: target, adapt: false };
  }

  if (!isObject(raw)) return null;
  const target = asLevel(raw.target) ?? asLevel(raw.floor) ?? asLevel(raw.ceiling);
  if (!target) return null;

  const adapt = Boolean(raw.adapt);
  const floor = adapt ? asLevel(raw.floor) ?? target : target;
  const ceiling = adapt ? asLevel(raw.ceiling) ?? target : target;
  return {
    target,
    floor,
    ceiling,
    adapt
  };
}

function resolveDimension(
  voice: Record<string, unknown>,
  dimension: DimensionName
): EnvelopeDimension | null {
  return normalizeDimension(voice?.[dimension]);
}

export function lteLevel(left: unknown, right: unknown): boolean {
  const leftLevel = asLevel(left);
  const rightLevel = asLevel(right);
  if (!leftLevel || !rightLevel) return false;
  const leftIndex = LEVEL_INDEX.get(leftLevel);
  const rightIndex = LEVEL_INDEX.get(rightLevel);
  if (leftIndex == null || rightIndex == null) return false;
  return leftIndex <= rightIndex;
}

export function gteLevel(left: unknown, right: unknown): boolean {
  const leftLevel = asLevel(left);
  const rightLevel = asLevel(right);
  if (!leftLevel || !rightLevel) return false;
  const leftIndex = LEVEL_INDEX.get(leftLevel);
  const rightIndex = LEVEL_INDEX.get(rightLevel);
  if (leftIndex == null || rightIndex == null) return false;
  return leftIndex >= rightIndex;
}

export function buildS002Envelope(
  profile: PersonalityProfile,
  adaptation: ContextAdaptation | null = null
): S002Envelope {
  const baseVoice = isObject(profile?.voice) ? profile.voice : {};
  const adjustments =
    adaptation && isObject(adaptation.adjustments) ? adaptation.adjustments : {};
  const voice = { ...baseVoice, ...adjustments };

  const envelope = {} as S002Envelope;
  for (const dimension of DIMENSIONS) {
    envelope[dimension] = resolveDimension(voice, dimension as DimensionName);
  }
  return envelope;
}

export function buildS002Envelopes(profile: PersonalityProfile): Array<{
  source: string;
  envelope: S002Envelope;
}> {
  const envelopes = [
    {
      source: "base",
      envelope: buildS002Envelope(profile)
    }
  ];

  for (const adaptation of Array.isArray(profile?.context_adaptations)
    ? profile.context_adaptations
    : []) {
    const adjustments =
      adaptation && isObject(adaptation.adjustments) ? adaptation.adjustments : null;
    if (!adjustments || Object.keys(adjustments).length === 0) continue;

    envelopes.push({
      source: `context:${String(adaptation?.when ?? "unknown")}`,
      envelope: buildS002Envelope(profile, adaptation)
    });
  }

  return envelopes;
}
