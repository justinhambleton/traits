const LEVEL_ORDER = ["very-low", "low", "medium", "high", "very-high"];
const LEVEL_INDEX = new Map(LEVEL_ORDER.map((level, idx) => [level, idx]));
const DIMENSIONS = [
  "formality",
  "warmth",
  "verbosity",
  "directness",
  "empathy",
  "humor"
];

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asLevel(value) {
  if (typeof value !== "string") return null;
  if (!LEVEL_INDEX.has(value)) return null;
  return value;
}

function normalizeDimension(raw) {
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

function resolveDimension(voice, dimension) {
  return normalizeDimension(voice?.[dimension]);
}

export function lteLevel(left, right) {
  const leftLevel = asLevel(left);
  const rightLevel = asLevel(right);
  if (!leftLevel || !rightLevel) return false;
  return LEVEL_INDEX.get(leftLevel) <= LEVEL_INDEX.get(rightLevel);
}

export function gteLevel(left, right) {
  const leftLevel = asLevel(left);
  const rightLevel = asLevel(right);
  if (!leftLevel || !rightLevel) return false;
  return LEVEL_INDEX.get(leftLevel) >= LEVEL_INDEX.get(rightLevel);
}

export function buildS002Envelope(profile, adaptation = null) {
  const baseVoice = isObject(profile?.voice) ? profile.voice : {};
  const adjustments =
    adaptation && isObject(adaptation.adjustments) ? adaptation.adjustments : {};
  const voice = { ...baseVoice, ...adjustments };

  const envelope = {};
  for (const dimension of DIMENSIONS) {
    envelope[dimension] = resolveDimension(voice, dimension);
  }
  return envelope;
}

export function buildS002Envelopes(profile) {
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
