import { validateProfile } from "../validator/engine.js";
import { asArray, DIMENSIONS } from "../utils.js";
import { openAIEmbed } from "./providers/openai.js";
import type { PersonalityProfile, ValidationResult } from "../types.js";

type EvalSample = {
  id?: string;
  prompt?: string;
  response?: string;
};

type Tier2Options = {
  includeHelpfulness?: boolean;
  strict?: boolean;
  bundledProfilesDir?: string;
  openaiApiKey?: string;
  embeddingModel?: string;
  openaiBaseUrl?: string;
  openAIBaseUrl?: string;
  fetchImpl?: typeof fetch;
  fetchTimeoutMs?: number;
  fetchMaxRetries?: number;
  fetchRetryBaseMs?: number;
  embeddingFn?: (text: string) => Promise<number[]>;
};

function targetLevel(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const target = (value as { target?: unknown }).target;
    if (typeof target === "string") {
      return target;
    }
  }
  return "medium";
}

function clamp01(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(1, num));
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length !== vecB.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < vecA.length; index += 1) {
    const a = Number(vecA[index]) || 0;
    const b = Number(vecB[index]) || 0;
    dot += a * b;
    normA += a * a;
    normB += b * b;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function normalizeCosine(similarity: number): number {
  return clamp01((similarity + 1) / 2);
}

function buildDimensionReferenceText(dimension: string, level: string): string {
  return `Reference response style for ${dimension} at ${level} level.`;
}

function buildHelpfulnessReference(profile: PersonalityProfile, sample: EvalSample): string {
  if (sample?.prompt) return String(sample.prompt);
  if (profile?.meta?.description) return String(profile.meta.description);
  return String(profile?.identity?.role ?? "helpful assistant response");
}

function makeEmbeddingFunction(
  options: Tier2Options = {}
): (text: string) => Promise<number[]> {
  if (typeof options.embeddingFn === "function") return options.embeddingFn;
  const apiKey = options.openaiApiKey ?? process.env.TRAITS_OPENAI_API_KEY;
  if (!apiKey) {
    const error = new Error("Tier 2 requires TRAITS_OPENAI_API_KEY.");
    (error as Error & { code?: string }).code = "E_EVAL_TIER2_UNAVAILABLE";
    throw error;
  }
  return (text) =>
    openAIEmbed({
      apiKey,
      input: text,
      model: options.embeddingModel ?? "text-embedding-3-small",
      baseUrl: options.openaiBaseUrl ?? options.openAIBaseUrl,
      fetchImpl: options.fetchImpl,
      timeoutMs: options.fetchTimeoutMs,
      maxRetries: options.fetchMaxRetries,
      retryBaseMs: options.fetchRetryBaseMs
    });
}

export async function runTier2Evaluation(
  profile: PersonalityProfile,
  samples: EvalSample[],
  options: Tier2Options = {}
): Promise<{
  tier: number;
  provider: string;
  helpfulness_included: boolean;
  sample_count: number;
  average_score: number;
  dimension_averages: Record<string, number>;
  helpfulness_average: number | null;
  samples: Array<{
    id: string;
    score: number;
    dimension_scores: Record<string, number>;
    helpfulness_score: number | null;
  }>;
}> {
  const embed = makeEmbeddingFunction(options);
  const includeHelpfulness = options.includeHelpfulness !== false;
  const items = asArray<EvalSample>(samples);
  const voice = profile?.voice ?? {};
  const cache = new Map<string, number[]>();

  async function getEmbedding(text: string): Promise<number[]> {
    const key = String(text);
    if (cache.has(key)) {
      const cached = cache.get(key);
      if (cached) return cached;
    }
    const embedding = await embed(key);
    cache.set(key, embedding);
    return embedding;
  }

  const dimensionRefs: Record<string, number[]> = {};
  for (const dimension of DIMENSIONS) {
    const level = targetLevel(voice?.[dimension]);
    const refText = buildDimensionReferenceText(dimension, level);
    dimensionRefs[dimension] = await getEmbedding(refText);
  }

  const perSample: Array<{
    id: string;
    score: number;
    dimension_scores: Record<string, number>;
    helpfulness_score: number | null;
  }> = [];
  for (const sample of items) {
    const responseText = String(sample?.response ?? "");
    const responseEmbedding = await getEmbedding(responseText);
    const dimensionScores: Record<string, number> = {};
    for (const dimension of DIMENSIONS) {
      const similarity = cosineSimilarity(responseEmbedding, dimensionRefs[dimension]);
      dimensionScores[dimension] = normalizeCosine(similarity);
    }

    let helpfulnessScore = null;
    if (includeHelpfulness) {
      const helpfulnessReference = buildHelpfulnessReference(profile, sample);
      const helpfulnessEmbedding = await getEmbedding(helpfulnessReference);
      helpfulnessScore = normalizeCosine(
        cosineSimilarity(responseEmbedding, helpfulnessEmbedding)
      );
    }

    const dimAverage =
      DIMENSIONS.reduce((sum, dimension) => sum + dimensionScores[dimension], 0) /
      DIMENSIONS.length;
    const score = includeHelpfulness
      ? clamp01(0.7 * dimAverage + 0.3 * (helpfulnessScore ?? 0))
      : clamp01(dimAverage);

    perSample.push({
      id: sample?.id ?? "unknown",
      score,
      dimension_scores: dimensionScores,
      helpfulness_score: helpfulnessScore
    });
  }

  const averageScore =
    perSample.length === 0
      ? 0
      : perSample.reduce((sum, sample) => sum + sample.score, 0) / perSample.length;

  const dimensionAverages: Record<string, number> = {};
  for (const dimension of DIMENSIONS) {
    dimensionAverages[dimension] =
      perSample.length === 0
        ? 0
        : perSample.reduce((sum, sample) => sum + sample.dimension_scores[dimension], 0) /
          perSample.length;
  }
  const helpfulnessAverage = includeHelpfulness
    ? perSample.length === 0
      ? 0
      : perSample.reduce((sum, sample) => sum + (sample.helpfulness_score ?? 0), 0) /
        perSample.length
    : null;

  return {
    tier: 2,
    provider: "openai",
    helpfulness_included: includeHelpfulness,
    sample_count: perSample.length,
    average_score: averageScore,
    dimension_averages: dimensionAverages,
    helpfulness_average: helpfulnessAverage,
    samples: perSample
  };
}

export async function runTier2EvaluationForProfile(
  profilePath: string,
  samples: EvalSample[],
  options: Tier2Options = {}
): Promise<{
  validation: ValidationResult;
  report: Awaited<ReturnType<typeof runTier2Evaluation>>;
}> {
  const validation = validateProfile(profilePath, {
    strict: Boolean(options.strict),
    bundledProfilesDir: options.bundledProfilesDir
  });
  if (validation.effectiveErrors.length > 0) {
    const error = new Error("Profile failed validation for eval.");
    (error as Error & { code?: string; validation?: unknown }).code = "E_EVAL_VALIDATION";
    (error as Error & { code?: string; validation?: unknown }).validation = validation;
    throw error;
  }

  if (!validation.profile) {
    const error = new Error("Profile failed validation for eval.");
    (error as Error & { code?: string; validation?: unknown }).code = "E_EVAL_VALIDATION";
    (error as Error & { code?: string; validation?: unknown }).validation = validation;
    throw error;
  }

  const report = await runTier2Evaluation(validation.profile, samples, options);
  return {
    validation,
    report
  };
}
