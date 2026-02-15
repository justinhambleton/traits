import fs from "node:fs";
import path from "node:path";
import type { DimensionName, Level } from "../types.js";

type ModelFlavor = "claude" | "gpt" | "generic";
type PatternEntry = {
  pattern?: string;
  adherence?: number | null;
  calibrated?: boolean;
};
type PatternData = {
  version?: string;
  dimensions?: Record<string, Record<string, PatternEntry>>;
  interactions?: Record<string, PatternEntry>;
};
type Selection = {
  dimension: string;
  level: string;
  pattern: string;
  adherence: number | null;
  source: string;
};
type InteractionSelection = {
  id: string;
  pattern: string;
  adherence: number | null;
  source: string;
};
const KB_CACHE = new Map<string, PatternData | null>();

function canLoadKnowledgeBaseFromFs(): boolean {
  return (
    typeof process !== "undefined" &&
    Boolean(process?.versions?.node) &&
    typeof fs?.existsSync === "function" &&
    typeof fs?.readFileSync === "function" &&
    typeof path?.resolve === "function"
  );
}

function modelFlavor(model: unknown): ModelFlavor {
  if (/claude/i.test(String(model))) return "claude";
  if (/gpt/i.test(String(model))) return "gpt";
  return "generic";
}

function dimensionTargetLevel(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const target = (value as { target?: unknown }).target;
    if (typeof target === "string") return target;
  }
  return "medium";
}

function patternTemplate(flavor: ModelFlavor, dimension: string, level: string): string {
  if (flavor === "claude") {
    return `Use ${dimension} at ${level} with explicit behavioral framing.`;
  }
  if (flavor === "gpt") {
    return `Maintain ${dimension}=${level} with concise directive language.`;
  }
  return `Keep ${dimension} at ${level}.`;
}

function interactionTemplate(flavor: ModelFlavor, id: string): string {
  if (id === "warmth-high_directness-high") {
    return flavor === "gpt"
      ? "Acknowledge quickly, then move directly to concrete next steps."
      : "Lead with acknowledgment and pivot immediately to action.";
  }
  if (id === "empathy-very-high_directness-medium") {
    return flavor === "gpt"
      ? "Validate deeply, then provide one clear next step with concise rationale."
      : "Sustain deep validation while keeping recommendations concrete and actionable.";
  }
  if (id === "warmth-very-high_humor-very-low") {
    return flavor === "gpt"
      ? "Maintain compassionate language without levity; keep wording plain and serious."
      : "Hold a deeply caring tone without humor; avoid phrasing that can feel dismissive.";
  }
  if (id === "empathy-very-high_directness-low") {
    return "Preserve boundaries while validating emotion; never let empathy remove refusal clarity.";
  }
  if (id === "formality-high_humor-medium-plus") {
    return "Use restrained wit and avoid phrasing that weakens authority.";
  }
  return "Apply balanced interaction handling.";
}

function resolvePatternFile(
  model: unknown,
  options: { knowledgeBaseDir?: string } = {}
): string | null {
  const flavor = modelFlavor(model);
  if (flavor === "generic") return null;
  if (!canLoadKnowledgeBaseFromFs()) return null;
  const knowledgeBaseDir =
    options.knowledgeBaseDir ?? path.resolve(process.cwd(), "knowledge-base");
  return path.resolve(knowledgeBaseDir, flavor, "patterns.json");
}

function loadPatternData(
  model: unknown,
  options: { knowledgeBaseDir?: string } = {}
): PatternData | null {
  const patternFile = resolvePatternFile(model, options);
  if (!patternFile) return null;
  if (KB_CACHE.has(patternFile)) {
    const cached = KB_CACHE.get(patternFile);
    return cached ?? null;
  }

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

function normalizeLevel(level: unknown): string {
  return String(level ?? "medium").toLowerCase();
}

function isAtLeast(level: unknown, threshold: Level): boolean {
  const order: Level[] = ["very-low", "low", "medium", "high", "very-high"];
  return order.indexOf(normalizeLevel(level) as Level) >= order.indexOf(threshold);
}

function isAtMost(level: unknown, threshold: Level): boolean {
  const order: Level[] = ["very-low", "low", "medium", "high", "very-high"];
  return order.indexOf(normalizeLevel(level) as Level) <= order.indexOf(threshold);
}

function isExactly(level: unknown, target: Level): boolean {
  return normalizeLevel(level) === target;
}

export function selectPatterns(
  voice: Record<string, unknown>,
  model: unknown,
  options: { knowledgeBaseDir?: string } = {}
): Selection[] {
  const flavor = modelFlavor(model);
  const patternData = loadPatternData(model, options);
  const dimensions: DimensionName[] = [
    "formality",
    "warmth",
    "verbosity",
    "directness",
    "empathy",
    "humor"
  ];
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

export function selectInteractionPatterns(
  voice: Record<string, unknown>,
  model: unknown,
  options: { knowledgeBaseDir?: string } = {}
): InteractionSelection[] {
  const flavor = modelFlavor(model);
  const patternData = loadPatternData(model, options);
  const warmth = dimensionTargetLevel(voice?.warmth);
  const directness = dimensionTargetLevel(voice?.directness);
  const empathy = dimensionTargetLevel(voice?.empathy);
  const formality = dimensionTargetLevel(voice?.formality);
  const humor = dimensionTargetLevel(voice?.humor);
  const interactions: InteractionSelection[] = [];

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

  if (isAtLeast(empathy, "very-high") && isExactly(directness, "medium")) {
    const entry = patternData?.interactions?.["empathy-very-high_directness-medium"];
    interactions.push({
      id: "empathy-very-high_directness-medium",
      pattern:
        entry?.pattern ??
        interactionTemplate(flavor, "empathy-very-high_directness-medium"),
      adherence: entry?.adherence ?? null,
      source: entry ? `knowledge-base:${String(patternData?.version ?? "unknown")}` : "built-in"
    });
  }

  if (isAtLeast(warmth, "very-high") && isExactly(humor, "very-low")) {
    const entry = patternData?.interactions?.["warmth-very-high_humor-very-low"];
    interactions.push({
      id: "warmth-very-high_humor-very-low",
      pattern:
        entry?.pattern ?? interactionTemplate(flavor, "warmth-very-high_humor-very-low"),
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
