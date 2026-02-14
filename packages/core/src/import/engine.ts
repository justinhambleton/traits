import { stringify as toYaml } from "yaml";

import { anthropicJudge } from "../eval/providers/anthropic.js";
import { openAIJudge } from "../eval/providers/openai.js";
import { asArray, LEVELS } from "../utils.js";
import type {
  DimensionValue,
  HumorDimensionValue,
  HumorStyle,
  Level,
  PersonalityProfile
} from "../types.js";

const HUMOR_STYLES: HumorStyle[] = ["none", "dry", "subtle-wit", "playful"];

type ImportOptions = {
  provider?: string;
  analysisFn?: (args: { systemPrompt: string; userPrompt: string }) => Promise<unknown>;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  model?: string;
  openaiBaseUrl?: string;
  openAIBaseUrl?: string;
  anthropicBaseUrl?: string;
  fetchImpl?: typeof fetch;
  fetchTimeoutMs?: number;
  fetchMaxRetries?: number;
  fetchRetryBaseMs?: number;
  profileName?: string;
  description?: string;
};

type ImportProvider = {
  provider: string;
  analyzeFn: (args: { systemPrompt: string; userPrompt: string }) => Promise<unknown>;
};

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function normalizeLevel(value: unknown, fallback: Level = "medium"): Level {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (!LEVELS.includes(normalized as Level)) return fallback;
  return normalized as Level;
}

function normalizeHumorStyle(value: unknown): HumorStyle {
  if (typeof value !== "string") return "none";
  const normalized = value.trim().toLowerCase();
  if (!HUMOR_STYLES.includes(normalized as HumorStyle)) return "none";
  return normalized as HumorStyle;
}

function normalizeStringArray(value: unknown, limit = 12): string[] {
  const deduped = new Set<string>();
  for (const item of asArray<unknown>(value)) {
    const normalized = String(item ?? "").trim();
    if (!normalized) continue;
    if (deduped.has(normalized)) continue;
    deduped.add(normalized);
    if (deduped.size >= limit) break;
  }
  return [...deduped];
}

function normalizeDimensionValue(
  value: unknown,
  fallbackLevel: Level = "medium"
): DimensionValue {
  if (typeof value === "string") {
    return normalizeLevel(value, fallbackLevel);
  }

  const dimension = asObject(value);
  const target = normalizeLevel(dimension.target ?? dimension.level, fallbackLevel);
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

function normalizeHumorValue(value: unknown): HumorDimensionValue {
  if (typeof value === "string") {
    return {
      target: normalizeLevel(value, "low"),
      style: "none"
    };
  }

  const dimension = asObject(value);
  return {
    target: normalizeLevel(dimension.target ?? dimension.level, "low"),
    style: normalizeHumorStyle((dimension as { style?: unknown }).style)
  };
}

function slugifyName(value: unknown): string {
  const slug = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "imported-profile";
}

function extractJSONObject(text: unknown): Record<string, unknown> {
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

function selectImportProvider(options: ImportOptions = {}): ImportProvider {
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
      (error as Error & { code?: string }).code = "E_IMPORT_PROVIDER_UNAVAILABLE";
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
      (error as Error & { code?: string }).code = "E_IMPORT_PROVIDER_UNAVAILABLE";
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
  (error as Error & { code?: string }).code = "E_IMPORT_PROVIDER_UNAVAILABLE";
  throw error;
}

function buildImportSystemPrompt(): string {
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

function buildImportUserPrompt(promptText: unknown): string {
  return [
    "System prompt to analyze:",
    "<system_prompt>",
    String(promptText ?? ""),
    "</system_prompt>"
  ].join("\n");
}

export function mapImportAnalysisToProfile(
  analysis: unknown,
  options: ImportOptions = {}
): PersonalityProfile {
  const source = asObject(analysis);
  const dimensions = asObject(source.detected_dimensions);
  const vocabulary = asObject(source.detected_vocabulary);

  const profileName =
    options.profileName ?? slugifyName(source.detected_role ?? "imported-profile");
  const role =
    String(source.detected_role ?? "Helpful assistant").trim() || "Helpful assistant";
  const notes = String(source.notes ?? "").trim();
  const confidence =
    typeof source.confidence === "number" && Number.isFinite(source.confidence)
      ? source.confidence
      : null;

  const preferredTerms = normalizeStringArray(vocabulary.preferred, 16);
  const forbiddenTerms = normalizeStringArray(vocabulary.forbidden, 16);
  const behavioralRules = normalizeStringArray(source.detected_behavioral_rules, 20);

  const profile: PersonalityProfile = {
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

export function renderImportedProfileYAML(profile: PersonalityProfile): string {
  return toYaml(profile);
}

export async function runImportAnalysis(
  promptText: unknown,
  options: ImportOptions = {}
): Promise<{
  provider: string;
  analysis: Record<string, unknown>;
  profile: PersonalityProfile;
  yaml: string;
}> {
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
