import { validateProfile } from "../validator/engine.js";
import { openAIEmbed } from "./providers/openai.js";

const DIMENSIONS = ["formality", "warmth", "verbosity", "directness", "empathy", "humor"];

function asArray(value) {
  if (!Array.isArray(value)) return [];
  return value;
}

function targetLevel(value) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof value.target === "string") {
    return value.target;
  }
  return "medium";
}

function clamp01(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(1, num));
}

function cosineSimilarity(vecA, vecB) {
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

function normalizeCosine(similarity) {
  return clamp01((similarity + 1) / 2);
}

function buildDimensionReferenceText(dimension, level) {
  return `Reference response style for ${dimension} at ${level} level.`;
}

function buildHelpfulnessReference(profile, sample) {
  if (sample?.prompt) return String(sample.prompt);
  if (profile?.meta?.description) return String(profile.meta.description);
  return String(profile?.identity?.role ?? "helpful assistant response");
}

function makeEmbeddingFunction(options = {}) {
  if (typeof options.embeddingFn === "function") return options.embeddingFn;
  const apiKey = options.openaiApiKey ?? process.env.TRAITS_OPENAI_API_KEY;
  if (!apiKey) {
    const error = new Error("Tier 2 requires TRAITS_OPENAI_API_KEY.");
    error.code = "E_EVAL_TIER2_UNAVAILABLE";
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

export async function runTier2Evaluation(profile, samples, options = {}) {
  const embed = makeEmbeddingFunction(options);
  const includeHelpfulness = options.includeHelpfulness !== false;
  const items = asArray(samples);
  const voice = profile?.voice ?? {};
  const cache = new Map();

  async function getEmbedding(text) {
    const key = String(text);
    if (cache.has(key)) return cache.get(key);
    const embedding = await embed(key);
    cache.set(key, embedding);
    return embedding;
  }

  const dimensionRefs = {};
  for (const dimension of DIMENSIONS) {
    const level = targetLevel(voice?.[dimension]);
    const refText = buildDimensionReferenceText(dimension, level);
    dimensionRefs[dimension] = await getEmbedding(refText);
  }

  const perSample = [];
  for (const sample of items) {
    const responseText = String(sample?.response ?? "");
    const responseEmbedding = await getEmbedding(responseText);
    const dimensionScores = {};
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
      ? clamp01(0.7 * dimAverage + 0.3 * helpfulnessScore)
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

  const dimensionAverages = {};
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

export async function runTier2EvaluationForProfile(profilePath, samples, options = {}) {
  const validation = validateProfile(profilePath, {
    strict: Boolean(options.strict),
    bundledProfilesDir: options.bundledProfilesDir
  });
  if (validation.effectiveErrors.length > 0) {
    const error = new Error("Profile failed validation for eval.");
    error.code = "E_EVAL_VALIDATION";
    error.validation = validation;
    throw error;
  }

  const report = await runTier2Evaluation(validation.profile, samples, options);
  return {
    validation,
    report
  };
}
