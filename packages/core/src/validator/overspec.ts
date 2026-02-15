import { asArray, normalizeRuleConstraints } from "../utils.js";
import type { PersonalityProfile, ValidationDiagnostic } from "../types.js";

export function computeConstraintCount(profile: PersonalityProfile): {
  total: number;
  breakdown: {
    behavioral_rules: number;
    vocabulary_preferred_terms: number;
    vocabulary_forbidden_terms: number;
    context_adaptations: number;
  };
} {
  const behavioralRules = normalizeRuleConstraints(profile?.behavioral_rules).length;
  const preferredTerms = asArray<string>(profile?.vocabulary?.preferred_terms).length;
  const forbiddenTerms = asArray<string>(profile?.vocabulary?.forbidden_terms).length;
  const contextAdaptations = asArray(profile?.context_adaptations).length;

  const total = behavioralRules + preferredTerms + forbiddenTerms + contextAdaptations;

  return {
    total,
    breakdown: {
      behavioral_rules: behavioralRules,
      vocabulary_preferred_terms: preferredTerms,
      vocabulary_forbidden_terms: forbiddenTerms,
      context_adaptations: contextAdaptations
    }
  };
}

export function checkOverspec(profile: PersonalityProfile): {
  total: number;
  breakdown: {
    behavioral_rules: number;
    vocabulary_preferred_terms: number;
    vocabulary_forbidden_terms: number;
    context_adaptations: number;
  };
  diagnostics: ValidationDiagnostic[];
} {
  const { total, breakdown } = computeConstraintCount(profile);
  const diagnostics: ValidationDiagnostic[] = [];

  if (total > 30) {
    diagnostics.push({
      code: "S004",
      severity: "error",
      message: `Constraint count is ${total}, above the hard limit of 30.`,
      details: breakdown
    });
  } else if (total > 15) {
    diagnostics.push({
      code: "S004",
      severity: "warning",
      message: `Constraint count is ${total}, above the warning threshold of 15.`,
      details: breakdown
    });
  }

  return {
    total,
    breakdown,
    diagnostics
  };
}
