import { validateProfile } from "../validator/engine.js";

function asArray(value) {
  if (!Array.isArray(value)) return [];
  return value;
}

function normalize(value) {
  return String(value ?? "").toLowerCase();
}

function countMatches(text, terms) {
  const lowered = normalize(text);
  let count = 0;
  for (const term of terms) {
    if (!term) continue;
    if (lowered.includes(normalize(term))) count += 1;
  }
  return count;
}

export function evaluateTier1Response(profile, responseText, options = {}) {
  const response = String(responseText ?? "");
  const includeHelpfulness = options.includeHelpfulness !== false;
  const preferredTerms = asArray(profile?.vocabulary?.preferred_terms);
  const forbiddenTerms = asArray(profile?.vocabulary?.forbidden_terms);

  const preferredMatches = countMatches(response, preferredTerms);
  const forbiddenMatches = countMatches(response, forbiddenTerms);

  const vocabularyCheck = {
    preferred_total: preferredTerms.length,
    preferred_matched: preferredMatches,
    forbidden_total: forbiddenTerms.length,
    forbidden_matched: forbiddenMatches,
    pass: forbiddenMatches === 0
  };

  const behavioralRules = asArray(profile?.behavioral_rules);
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
  const score = includeHelpfulness
    ? Math.max(
        0,
        0.45 * preferredCoverage + 0.35 * (1 - forbiddenPenalty) + 0.2 * helpfulnessScore
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

export function runTier1Evaluation(profile, samples, options = {}) {
  const items = asArray(samples);
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

export function runTier1EvaluationForProfile(profilePath, samples, options = {}) {
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

  const report = runTier1Evaluation(validation.profile, samples, options);
  return {
    validation,
    report
  };
}
