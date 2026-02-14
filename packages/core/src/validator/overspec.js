function asArray(value) {
  if (!Array.isArray(value)) return [];
  return value;
}

export function computeConstraintCount(profile) {
  const behavioralRules = asArray(profile?.behavioral_rules).length;
  const preferredTerms = asArray(profile?.vocabulary?.preferred_terms).length;
  const forbiddenTerms = asArray(profile?.vocabulary?.forbidden_terms).length;
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

export function checkOverspec(profile) {
  const { total, breakdown } = computeConstraintCount(profile);
  const diagnostics = [];

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
