import { validateProfile } from "../validator/engine.js";
import { asArray, normalizeRuleConstraints } from "../utils.js";
import type { PersonalityProfile, ValidationResult } from "../types.js";
import type { EvalSample } from "./types.js";

export type Tier1Options = {
  includeHelpfulness?: boolean;
  strict?: boolean;
  bundledProfilesDir?: string;
};

function normalize(value: unknown): string {
  return String(value ?? "").toLowerCase();
}

function countMatches(text: string, terms: string[]): number {
  const lowered = normalize(text);
  let count = 0;
  for (const term of terms) {
    if (!term) continue;
    if (lowered.includes(normalize(term))) count += 1;
  }
  return count;
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
  };
} {
  const response = String(responseText ?? "");
  const includeHelpfulness = options.includeHelpfulness !== false;
  const preferredTerms = asArray<string>(profile?.vocabulary?.preferred_terms);
  const forbiddenTerms = asArray<string>(profile?.vocabulary?.forbidden_terms);

  const preferredMatches = countMatches(response, preferredTerms);
  const forbiddenMatches = countMatches(response, forbiddenTerms);

  const vocabularyCheck = {
    preferred_total: preferredTerms.length,
    preferred_matched: preferredMatches,
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

  const preferredCoverage =
    preferredTerms.length === 0 ? 1 : preferredMatches / preferredTerms.length;
  const forbiddenPenalty =
    forbiddenTerms.length === 0 ? 0 : forbiddenMatches / forbiddenTerms.length;
  const helpfulnessScore = includeHelpfulness
    ? helpfulnessCheck.pass
      ? 1
      : Math.min(1, response.trim().length / 40)
    : null;
  const helpfulnessWeighted = helpfulnessScore ?? 0;
  const score = includeHelpfulness
    ? Math.max(
        0,
        0.45 * preferredCoverage + 0.35 * (1 - forbiddenPenalty) + 0.2 * helpfulnessWeighted
      )
    : Math.max(0, 0.55 * preferredCoverage + 0.45 * (1 - forbiddenPenalty));

  return {
    score,
    checks: {
      vocabulary: vocabularyCheck,
      structure: structureCheck,
      helpfulness: helpfulnessCheck
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
