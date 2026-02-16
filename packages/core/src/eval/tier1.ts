import { validateProfile } from "../validator/engine.js";
import { asArray, normalizeRuleConstraints } from "../utils.js";
import {
  countHumorSignalHits,
  countSignalHits,
  getDimensionSignalSet
} from "./dimension-signals.js";
import type {
  DimensionName,
  HumorDimensionValue,
  Level,
  PersonalityProfile,
  ValidationResult
} from "../types.js";
import type { EvalSample } from "./types.js";

export type Tier1Options = {
  includeHelpfulness?: boolean;
  strict?: boolean;
  bundledProfilesDir?: string;
};

function normalize(value: unknown): string {
  return String(value ?? "").toLowerCase();
}

const LEVELS: Level[] = ["very-low", "low", "medium", "high", "very-high"];
const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "is",
  "it",
  "to",
  "i",
  "you",
  "that"
]);

const DIMENSIONS: DimensionName[] = [
  "formality",
  "warmth",
  "verbosity",
  "directness",
  "empathy",
  "humor"
];

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function countExactMatches(text: string, terms: string[]): number {
  const lowered = normalize(text);
  let count = 0;
  for (const term of terms) {
    if (!term) continue;
    if (lowered.includes(normalize(term))) count += 1;
  }
  return count;
}

function extractWords(value: string): string[] {
  return String(value ?? "").toLowerCase().match(/[a-z0-9']+/g) ?? [];
}

function significantWords(value: string): string[] {
  return extractWords(value).filter((word) => !STOPWORDS.has(word));
}

function preferredTermCoverage(term: string, responseWords: Set<string>): number {
  const words = significantWords(term);
  if (words.length === 0) return 0;
  if (words.length === 1) return responseWords.has(words[0]) ? 1 : 0;

  let matched = 0;
  for (const word of words) {
    if (responseWords.has(word)) matched += 1;
  }
  return matched / words.length;
}

function scorePreferredTerms(
  response: string,
  terms: string[]
): {
  matchedCount: number;
  coverage: number;
} {
  if (terms.length === 0) {
    return {
      matchedCount: 0,
      coverage: 1
    };
  }

  const responseWords = new Set(extractWords(response));
  let matchedCount = 0;
  let coverageTotal = 0;

  for (const term of terms) {
    const coverage = preferredTermCoverage(term, responseWords);
    coverageTotal += coverage;
    if (coverage >= 0.5) matchedCount += 1;
  }

  return {
    matchedCount,
    coverage: coverageTotal / terms.length
  };
}

function levelTarget(value: unknown): Level {
  if (typeof value === "string" && LEVELS.includes(value as Level)) {
    return value as Level;
  }
  if (value && typeof value === "object") {
    const target = (value as { target?: unknown }).target;
    if (typeof target === "string" && LEVELS.includes(target as Level)) {
      return target as Level;
    }
  }
  return "medium";
}

function scoreFromSignals(aligned: number, counter: number): number {
  const numerator = Math.max(0, Number(aligned));
  const denominator = numerator + Math.max(0, Number(counter)) + 1;
  if (denominator <= 0) return 0;
  return clamp01(numerator / denominator);
}

function verbosityProximity(target: Level, charCount: number): number {
  const count = Math.max(0, Number(charCount));
  if (target === "very-low" || target === "low") {
    if (count <= 300) return 1;
    if (count >= 900) return 0;
    return 1 - (count - 300) / 600;
  }
  if (target === "medium") {
    if (count >= 200 && count <= 800) return 1;
    if (count < 200) return count / 200;
    if (count >= 1600) return 0;
    return 1 - (count - 800) / 800;
  }
  if (count >= 400) return 1;
  if (count <= 80) return 0;
  return (count - 80) / 320;
}

function scoreDimension(
  dimension: DimensionName,
  target: Level,
  response: string,
  charCount: number
): {
  aligned: number;
  counter: number;
  score: number;
} {
  if (dimension === "verbosity") {
    const proximity = clamp01(verbosityProximity(target, charCount));
    const aligned = proximity * 6;
    const counter = (1 - proximity) * 2;
    return {
      aligned,
      counter,
      score: scoreFromSignals(aligned, counter)
    };
  }

  if (dimension === "humor") {
    const humorHits = countHumorSignalHits(response);
    if (target === "very-low" || target === "low") {
      const aligned = humorHits === 0 ? 6 : 1;
      const counter = humorHits;
      return {
        aligned,
        counter,
        score: scoreFromSignals(aligned, counter)
      };
    }
    if (target === "medium") {
      const aligned = humorHits >= 1 && humorHits <= 2 ? 4 : 1;
      const counter = humorHits === 0 ? 1 : Math.max(0, humorHits - 2);
      return {
        aligned,
        counter,
        score: scoreFromSignals(aligned, counter)
      };
    }
    const aligned = humorHits + 2;
    const counter = humorHits === 0 ? 3 : 0;
    return {
      aligned,
      counter,
      score: scoreFromSignals(aligned, counter)
    };
  }

  const signalSet = getDimensionSignalSet(dimension);
  if (!signalSet) {
    return {
      aligned: 0,
      counter: 0,
      score: 0
    };
  }

  const highHits = countSignalHits(response, signalSet.high);
  const lowHits = countSignalHits(response, signalSet.low);

  if (target === "high" || target === "very-high") {
    return {
      aligned: highHits,
      counter: lowHits,
      score: scoreFromSignals(highHits, lowHits)
    };
  }
  if (target === "low" || target === "very-low") {
    return {
      aligned: lowHits,
      counter: highHits,
      score: scoreFromSignals(lowHits, highHits)
    };
  }

  const aligned = 0.5 * (highHits + lowHits);
  const counter = 0.5 * Math.abs(highHits - lowHits);
  return {
    aligned,
    counter,
    score: scoreFromSignals(aligned, counter)
  };
}

function dimensionAlignment(profile: PersonalityProfile, response: string): {
  alignmentScore: number;
  perDimension: Array<{
    dimension: string;
    target: string;
    aligned_signals: number;
    counter_signals: number;
    score: number;
  }>;
} {
  const charCount = response.trim().length;
  const details = DIMENSIONS.map((dimension) => {
    const target =
      dimension === "humor"
        ? levelTarget(profile?.voice?.humor as HumorDimensionValue | undefined)
        : levelTarget(profile?.voice?.[dimension]);
    const scored = scoreDimension(dimension, target, response, charCount);
    return {
      dimension,
      target,
      aligned_signals: Number(scored.aligned),
      counter_signals: Number(scored.counter),
      score: Number(scored.score)
    };
  });
  const alignmentScore =
    details.length === 0
      ? 0
      : details.reduce((sum, item) => sum + item.score, 0) / details.length;
  return {
    alignmentScore: clamp01(alignmentScore),
    perDimension: details
  };
}

export function evaluateTier1Response(
  profile: PersonalityProfile,
  responseText: string,
  options: Tier1Options = {}
): {
  score: number;
  checks: {
    vocabulary: {
      preferred_total: number;
      preferred_matched: number;
      preferred_coverage: number;
      forbidden_total: number;
      forbidden_matched: number;
      pass: boolean;
    };
    structure: {
      behavioral_rule_count: number;
      response_non_empty: boolean;
      pass: boolean;
    };
    helpfulness: {
      char_count: number;
      pass: boolean;
      skipped: boolean;
    };
    dimensions: {
      alignment_score: number;
      per_dimension: Array<{
        dimension: string;
        target: string;
        aligned_signals: number;
        counter_signals: number;
        score: number;
      }>;
    };
  };
} {
  const response = String(responseText ?? "");
  const includeHelpfulness = options.includeHelpfulness !== false;
  const preferredTerms = asArray<string>(profile?.vocabulary?.preferred_terms);
  const forbiddenTerms = asArray<string>(profile?.vocabulary?.forbidden_terms);

  const preferred = scorePreferredTerms(response, preferredTerms);
  const forbiddenMatches = countExactMatches(response, forbiddenTerms);

  const vocabularyCheck = {
    preferred_total: preferredTerms.length,
    preferred_matched: preferred.matchedCount,
    preferred_coverage: preferred.coverage,
    forbidden_total: forbiddenTerms.length,
    forbidden_matched: forbiddenMatches,
    pass: forbiddenMatches === 0
  };

  const behavioralRules = normalizeRuleConstraints(profile?.behavioral_rules);
  const structureCheck = {
    behavioral_rule_count: behavioralRules.length,
    response_non_empty: response.trim().length > 0,
    pass: response.trim().length > 0
  };

  const helpfulnessCheck = {
    char_count: response.trim().length,
    pass: includeHelpfulness ? response.trim().length >= 40 : true,
      skipped: !includeHelpfulness
    };

  const preferredCoverage = preferred.coverage;
  const forbiddenPenalty =
    forbiddenTerms.length === 0 ? 0 : forbiddenMatches / forbiddenTerms.length;
  const dimensions = dimensionAlignment(profile, response);
  const helpfulnessScore = includeHelpfulness
    ? helpfulnessCheck.pass
      ? 1
      : Math.min(1, response.trim().length / 40)
    : null;
  const weights = includeHelpfulness
    ? { preferred: 0.25, forbidden: 0.2, dimensions: 0.4, helpfulness: 0.15 }
    : { preferred: 0.25, forbidden: 0.2, dimensions: 0.4, helpfulness: 0 };
  const totalWeight =
    weights.preferred + weights.forbidden + weights.dimensions + weights.helpfulness;
  const weightedScore =
    weights.preferred * preferredCoverage +
    weights.forbidden * (1 - forbiddenPenalty) +
    weights.dimensions * dimensions.alignmentScore +
    weights.helpfulness * (helpfulnessScore ?? 0);
  const score = clamp01(totalWeight > 0 ? weightedScore / totalWeight : 0);

  return {
    score,
    checks: {
      vocabulary: vocabularyCheck,
      structure: structureCheck,
      helpfulness: helpfulnessCheck,
      dimensions: {
        alignment_score: dimensions.alignmentScore,
        per_dimension: dimensions.perDimension
      }
    }
  };
}

export function runTier1Evaluation(
  profile: PersonalityProfile,
  samples: EvalSample[],
  options: Tier1Options = {}
): {
  tier: number;
  sample_count: number;
  average_score: number;
  samples: Array<{
    id: string;
    score: number;
    checks: ReturnType<typeof evaluateTier1Response>["checks"];
  }>;
} {
  const items = asArray<EvalSample>(samples);
  const perSample = items.map((sample) => {
    const id = sample?.id ?? "unknown";
    const response = sample?.response ?? "";
    const result = evaluateTier1Response(profile, response, options);
    return {
      id,
      ...result
    };
  });

  const averageScore =
    perSample.length === 0
      ? 0
      : perSample.reduce((sum, item) => sum + item.score, 0) / perSample.length;

  return {
    tier: 1,
    sample_count: perSample.length,
    average_score: averageScore,
    samples: perSample
  };
}

export function runTier1EvaluationForProfile(
  profilePath: string,
  samples: EvalSample[],
  options: Tier1Options = {}
): {
  validation: ValidationResult;
  report: ReturnType<typeof runTier1Evaluation>;
} {
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

  const report = runTier1Evaluation(validation.profile, samples, options);
  return {
    validation,
    report
  };
}
