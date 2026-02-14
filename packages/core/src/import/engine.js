import { stringify as toYaml } from "yaml";

import { anthropicJudge } from "../eval/providers/anthropic.js";
import { openAIJudge } from "../eval/providers/openai.js";

const LEVELS = ["very-low", "low", "medium", "high", "very-high"];
const HUMOR_STYLES = ["none", "dry", "subtle-wit", "playful"];

function asArray(value) {
  if (!Array.isArray(value)) return [];
  return value;
}

function asObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}

function normalizeLevel(value, fallback = "medium") {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (!LEVELS.includes(normalized)) return fallback;
  return normalized;
}

function normalizeHumorStyle(value) {
  if (typeof value !== "string") return "none";
  const normalized = value.trim().toLowerCase();
  if (!HUMOR_STYLES.includes(normalized)) return "none";
  return normalized;
}

function normalizeStringArray(value, limit = 12) {
  const deduped = new Set();
  for (const item of asArray(value)) {
    const normalized = String(item ?? "").trim();
    if (!normalized) continue;
    if (deduped.has(normalized)) continue;
    deduped.add(normalized);
    if (deduped.size >= limit) break;
  }
  return [...deduped];
}

function normalizeDimensionValue(value, fallbackLevel = "medium") {
  if (typeof value === "string") {
    return normalizeLevel(value, fallbackLevel);
  }

  const dimension = asObject(value);
  const target = normalizeLevel(
    dimension.target ?? dimension.level,
    fallbackLevel
  );
  const adapt = dimension.adapt === true;
  if (!adapt) {
    return target;
  }

  return {
    target,
    adapt: true,
    floor: normalizeLevel(dimension.floor, "low"),
    ceiling: normalizeLevel(dimension.ceiling, "high")
  };
}

function normalizeHumorValue(value) {
  if (typeof value === "string") {
    return {
      target: normalizeLevel(value, "low"),
      style: "none"
    };
  }

  const dimension = asObject(value);
  return {
    target: normalizeLevel(dimension.target ?? dimension.level, "low"),
    style: normalizeHumorStyle(dimension.style)
  };
}

function slugifyName(value) {
  const slug = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "imported-profile";
}

function extractJSONObject(text) {
  const raw = String(text ?? "").trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("Import analysis response did not contain JSON.");
    }
    return JSON.parse(match[0]);
  }
}

function selectImportProvider(options = {}) {
  if (typeof options.analysisFn === "function") {
    return {
      provider: "custom",
      analyzeFn: options.analysisFn
    };
  }

  const requested = String(options.provider ?? "auto").toLowerCase();
  const openaiKey = options.openaiApiKey ?? process.env.TRAITS_OPENAI_API_KEY;
  const anthropicKey = options.anthropicApiKey ?? process.env.TRAITS_ANTHROPIC_API_KEY;

  if (requested === "openai" || (requested === "auto" && openaiKey)) {
    if (!openaiKey) {
      const error = new Error(
        "Import requested OpenAI provider but TRAITS_OPENAI_API_KEY is missing."
      );
      error.code = "E_IMPORT_PROVIDER_UNAVAILABLE";
      throw error;
    }
    return {
      provider: "openai",
      analyzeFn: ({ systemPrompt, userPrompt }) =>
        openAIJudge({
          apiKey: openaiKey,
          systemPrompt,
          userPrompt,
          model: options.model ?? "gpt-4o-mini",
          baseUrl: options.openaiBaseUrl ?? options.openAIBaseUrl,
          fetchImpl: options.fetchImpl,
          timeoutMs: options.fetchTimeoutMs,
          maxRetries: options.fetchMaxRetries,
          retryBaseMs: options.fetchRetryBaseMs
        })
    };
  }

  if (requested === "anthropic" || (requested === "auto" && anthropicKey)) {
    if (!anthropicKey) {
      const error = new Error(
        "Import requested Anthropic provider but TRAITS_ANTHROPIC_API_KEY is missing."
      );
      error.code = "E_IMPORT_PROVIDER_UNAVAILABLE";
      throw error;
    }
    return {
      provider: "anthropic",
      analyzeFn: ({ systemPrompt, userPrompt }) =>
        anthropicJudge({
          apiKey: anthropicKey,
          systemPrompt,
          userPrompt,
          model: options.model ?? "claude-3-5-sonnet-latest",
          baseUrl: options.anthropicBaseUrl,
          fetchImpl: options.fetchImpl,
          timeoutMs: options.fetchTimeoutMs,
          maxRetries: options.fetchMaxRetries,
          retryBaseMs: options.fetchRetryBaseMs
        })
    };
  }

  const error = new Error(
    "Import requires TRAITS_OPENAI_API_KEY or TRAITS_ANTHROPIC_API_KEY."
  );
  error.code = "E_IMPORT_PROVIDER_UNAVAILABLE";
  throw error;
}

function buildImportSystemPrompt() {
  return [
    "Analyze the system prompt and extract personality signals.",
    "Return strict JSON only with this shape:",
    "{",
    '  "detected_role": "string",',
    '  "detected_dimensions": {',
    '    "formality": "very-low|low|medium|high|very-high",',
    '    "warmth": "very-low|low|medium|high|very-high",',
    '    "verbosity": "very-low|low|medium|high|very-high",',
    '    "directness": "very-low|low|medium|high|very-high",',
    '    "empathy": "very-low|low|medium|high|very-high",',
    '    "humor": { "level": "very-low|low|medium|high|very-high", "style": "none|dry|subtle-wit|playful" }',
    "  },",
    '  "detected_vocabulary": { "preferred": ["..."], "forbidden": ["..."] },',
    '  "detected_behavioral_rules": ["..."],',
    '  "confidence": 0.0,',
    '  "notes": "short rationale"',
    "}",
    "Do not include markdown fences."
  ].join("\n");
}

function buildImportUserPrompt(promptText) {
  return [
    "System prompt to analyze:",
    "<system_prompt>",
    String(promptText ?? ""),
    "</system_prompt>"
  ].join("\n");
}

export function mapImportAnalysisToProfile(analysis, options = {}) {
  const source = asObject(analysis);
  const dimensions = asObject(source.detected_dimensions);
  const vocabulary = asObject(source.detected_vocabulary);

  const profileName =
    options.profileName ?? slugifyName(source.detected_role ?? "imported-profile");
  const role = String(source.detected_role ?? "Helpful assistant").trim() || "Helpful assistant";
  const notes = String(source.notes ?? "").trim();
  const confidence =
    typeof source.confidence === "number" && Number.isFinite(source.confidence)
      ? source.confidence
      : null;

  const preferredTerms = normalizeStringArray(vocabulary.preferred, 16);
  const forbiddenTerms = normalizeStringArray(vocabulary.forbidden, 16);
  const behavioralRules = normalizeStringArray(source.detected_behavioral_rules, 20);

  const profile = {
    schema: "v1.4",
    meta: {
      name: profileName,
      version: "0.1.0",
      description:
        options.description ??
        `Imported profile derived from an existing system prompt${confidence != null ? ` (confidence ${confidence.toFixed(2)})` : ""}.`,
      tags: ["imported"],
      target_audience: "General users"
    },
    identity: {
      role,
      backstory: notes || "Derived from imported system prompt analysis."
    },
    voice: {
      formality: normalizeDimensionValue(dimensions.formality, "medium"),
      warmth: normalizeDimensionValue(dimensions.warmth, "medium"),
      verbosity: normalizeDimensionValue(dimensions.verbosity, "medium"),
      directness: normalizeDimensionValue(dimensions.directness, "medium"),
      empathy: normalizeDimensionValue(dimensions.empathy, "medium"),
      humor: normalizeHumorValue(dimensions.humor)
    },
    vocabulary: {
      preferred_terms: preferredTerms,
      forbidden_terms: forbiddenTerms
    },
    behavioral_rules:
      behavioralRules.length > 0
        ? behavioralRules
        : ["Address the user's request directly and provide actionable help."]
  };

  return profile;
}

export function renderImportedProfileYAML(profile) {
  return toYaml(profile);
}

export async function runImportAnalysis(promptText, options = {}) {
  const provider = selectImportProvider(options);
  const raw = await provider.analyzeFn({
    systemPrompt: buildImportSystemPrompt(),
    userPrompt: buildImportUserPrompt(promptText)
  });

  const analysis = typeof raw === "string" ? extractJSONObject(raw) : asObject(raw);
  const profile = mapImportAnalysisToProfile(analysis, options);
  const yaml = renderImportedProfileYAML(profile);

  return {
    provider: provider.provider,
    analysis,
    profile,
    yaml
  };
}
