import fs from "node:fs";
import path from "node:path";

const KB_CACHE = new Map();

function modelFlavor(model) {
  if (/claude/i.test(String(model))) return "claude";
  if (/gpt/i.test(String(model))) return "gpt";
  return "generic";
}

function dimensionTargetLevel(value) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof value.target === "string") {
    return value.target;
  }
  return "medium";
}

function patternTemplate(flavor, dimension, level) {
  if (flavor === "claude") {
    return `Use ${dimension} at ${level} with explicit behavioral framing.`;
  }
  if (flavor === "gpt") {
    return `Maintain ${dimension}=${level} with concise directive language.`;
  }
  return `Keep ${dimension} at ${level}.`;
}

function interactionTemplate(flavor, id) {
  if (id === "warmth-high_directness-high") {
    return flavor === "gpt"
      ? "Acknowledge quickly, then move directly to concrete next steps."
      : "Lead with acknowledgment and pivot immediately to action.";
  }
  if (id === "empathy-very-high_directness-low") {
    return "Preserve boundaries while validating emotion; never let empathy remove refusal clarity.";
  }
  if (id === "formality-high_humor-medium-plus") {
    return "Use restrained wit and avoid phrasing that weakens authority.";
  }
  return "Apply balanced interaction handling.";
}

function resolvePatternFile(model, options = {}) {
  const flavor = modelFlavor(model);
  if (flavor === "generic") return null;
  const knowledgeBaseDir =
    options.knowledgeBaseDir ?? path.resolve(process.cwd(), "knowledge-base");
  return path.resolve(knowledgeBaseDir, flavor, "patterns.json");
}

function loadPatternData(model, options = {}) {
  const patternFile = resolvePatternFile(model, options);
  if (!patternFile) return null;
  if (KB_CACHE.has(patternFile)) return KB_CACHE.get(patternFile);

  try {
    if (!fs.existsSync(patternFile)) {
      KB_CACHE.set(patternFile, null);
      return null;
    }
    const raw = fs.readFileSync(patternFile, "utf8");
    const parsed = JSON.parse(raw);
    KB_CACHE.set(patternFile, parsed);
    return parsed;
  } catch {
    KB_CACHE.set(patternFile, null);
    return null;
  }
}

function normalizeLevel(level) {
  return String(level ?? "medium").toLowerCase();
}

function isAtLeast(level, threshold) {
  const order = ["very-low", "low", "medium", "high", "very-high"];
  return order.indexOf(normalizeLevel(level)) >= order.indexOf(threshold);
}

function isAtMost(level, threshold) {
  const order = ["very-low", "low", "medium", "high", "very-high"];
  return order.indexOf(normalizeLevel(level)) <= order.indexOf(threshold);
}

export function selectPatterns(voice, model, options = {}) {
  const flavor = modelFlavor(model);
  const patternData = loadPatternData(model, options);
  const dimensions = ["formality", "warmth", "verbosity", "directness", "empathy", "humor"];
  return dimensions.map((dimension) => {
    const level = dimensionTargetLevel(voice?.[dimension]);
    const levelEntry = patternData?.dimensions?.[dimension]?.[level];
    return {
      dimension,
      level,
      pattern: levelEntry?.pattern ?? patternTemplate(flavor, dimension, level),
      adherence: levelEntry?.adherence ?? null,
      source: levelEntry
        ? `knowledge-base:${String(patternData?.version ?? "unknown")}`
        : "built-in"
    };
  });
}

export function selectInteractionPatterns(voice, model, options = {}) {
  const flavor = modelFlavor(model);
  const patternData = loadPatternData(model, options);
  const warmth = dimensionTargetLevel(voice?.warmth);
  const directness = dimensionTargetLevel(voice?.directness);
  const empathy = dimensionTargetLevel(voice?.empathy);
  const formality = dimensionTargetLevel(voice?.formality);
  const humor = dimensionTargetLevel(voice?.humor);
  const interactions = [];

  if (isAtLeast(warmth, "high") && isAtLeast(directness, "high")) {
    const entry = patternData?.interactions?.["warmth-high_directness-high"];
    interactions.push({
      id: "warmth-high_directness-high",
      pattern:
        entry?.pattern ?? interactionTemplate(flavor, "warmth-high_directness-high"),
      adherence: entry?.adherence ?? null,
      source: entry ? `knowledge-base:${String(patternData?.version ?? "unknown")}` : "built-in"
    });
  }

  if (isAtLeast(empathy, "very-high") && isAtMost(directness, "low")) {
    const entry = patternData?.interactions?.["empathy-very-high_directness-low"];
    interactions.push({
      id: "empathy-very-high_directness-low",
      pattern:
        entry?.pattern ?? interactionTemplate(flavor, "empathy-very-high_directness-low"),
      adherence: entry?.adherence ?? null,
      source: entry ? `knowledge-base:${String(patternData?.version ?? "unknown")}` : "built-in"
    });
  }

  if (isAtLeast(formality, "high") && isAtLeast(humor, "medium")) {
    const entry = patternData?.interactions?.["formality-high_humor-medium-plus"];
    interactions.push({
      id: "formality-high_humor-medium-plus",
      pattern:
        entry?.pattern ?? interactionTemplate(flavor, "formality-high_humor-medium-plus"),
      adherence: entry?.adherence ?? null,
      source: entry ? `knowledge-base:${String(patternData?.version ?? "unknown")}` : "built-in"
    });
  }

  return interactions;
}
