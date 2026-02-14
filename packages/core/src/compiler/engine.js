import { resolveActiveContext } from "../profile.js";
import { validateProfile } from "../validator/engine.js";
import { selectInteractionPatterns, selectPatterns } from "./patterns.js";
import { getSafetyFloor, PROTECTED_REFUSAL_TERMS } from "./safety-floor.js";

function asArray(value) {
  if (!Array.isArray(value)) return [];
  return value;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isClaudeModel(model) {
  return /claude/i.test(String(model));
}

function isGptModel(model) {
  return /gpt/i.test(String(model));
}

function selectPlacement(model) {
  if (isClaudeModel(model)) {
    return {
      model,
      recommended_position: "start",
      rationale:
        "Claude generally responds best when personality guidance is front-loaded in the system prompt."
    };
  }
  if (isGptModel(model)) {
    return {
      model,
      recommended_position: "after_tools",
      rationale:
        "GPT-family models generally perform best when personality guidance follows tool definitions."
    };
  }
  return {
    model,
    recommended_position: "end",
    rationale:
      "Unknown model family; defaulting to end placement to reduce conflict with existing system instructions."
  };
}

function stringifyDimensionTarget(value) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") return String(value.target ?? "medium");
  return "medium";
}

function applyContextAdjustments(profile, context = {}) {
  const resolved = resolveActiveContext(profile, context);
  const effective = clone(profile);
  effective.voice = effective.voice ?? {};
  for (const [dimension, adjustment] of Object.entries(resolved.resolvedAdjustments)) {
    effective.voice[dimension] = clone(adjustment);
  }

  const behavioralRules = [...asArray(effective.behavioral_rules), ...resolved.injectRules];
  effective.behavioral_rules = behavioralRules;
  return {
    profile: effective,
    contextResolution: resolved
  };
}

function enforceProtectedVocabulary(forbiddenTerms) {
  const protectedLower = new Set(PROTECTED_REFUSAL_TERMS.map((term) => term.toLowerCase()));
  const restored = [];
  const filteredForbidden = [];

  for (const term of asArray(forbiddenTerms)) {
    const normalized = String(term).toLowerCase();
    if (protectedLower.has(normalized)) {
      restored.push(term);
      continue;
    }
    filteredForbidden.push(term);
  }

  return {
    filteredForbidden,
    restoredProtectedTerms: restored
  };
}

function estimateTokenCount(text) {
  const wordCount = String(text).trim().split(/\s+/).filter(Boolean).length;
  return Math.ceil(wordCount * 1.3);
}

function collectAdaptiveDimensions(voice = {}) {
  const adaptive = [];
  for (const [dimension, value] of Object.entries(voice)) {
    if (value && typeof value === "object" && value.adapt === true) {
      adaptive.push(dimension);
    }
  }
  return adaptive;
}

function renderPersonalityText(profile, model, contextResolution, compileOptions = {}) {
  const voice = profile.voice ?? {};
  const vocabulary = profile.vocabulary ?? {};
  const safeForbidden = enforceProtectedVocabulary(vocabulary.forbidden_terms);
  const safetyFloor = getSafetyFloor(model);
  const patternSelections = selectPatterns(voice, model, {
    knowledgeBaseDir: compileOptions.knowledgeBaseDir
  });
  const interactionPatterns = selectInteractionPatterns(voice, model, {
    knowledgeBaseDir: compileOptions.knowledgeBaseDir
  });

  const lines = [];
  lines.push("[TRAITS PERSONALITY]");
  lines.push(`Name: ${profile?.meta?.name ?? "unknown"}`);
  lines.push(`Version: ${profile?.meta?.version ?? "unknown"}`);
  lines.push("");
  lines.push("[IDENTITY]");
  lines.push(`Role: ${profile?.identity?.role ?? "assistant"}`);
  if (profile?.identity?.backstory) {
    lines.push(`Backstory: ${String(profile.identity.backstory).replace(/\s+/g, " ").trim()}`);
  }
  lines.push("");
  lines.push("[VOICE TARGETS]");
  lines.push(`formality: ${stringifyDimensionTarget(voice.formality)}`);
  lines.push(`warmth: ${stringifyDimensionTarget(voice.warmth)}`);
  lines.push(`verbosity: ${stringifyDimensionTarget(voice.verbosity)}`);
  lines.push(`directness: ${stringifyDimensionTarget(voice.directness)}`);
  lines.push(`empathy: ${stringifyDimensionTarget(voice.empathy)}`);
  lines.push(`humor: ${stringifyDimensionTarget(voice.humor)}`);
  if (voice.humor && typeof voice.humor === "object" && voice.humor.style) {
    lines.push(`humor_style: ${voice.humor.style}`);
  }
  lines.push("");
  lines.push("[PATTERN GUIDANCE]");
  for (const selection of patternSelections) {
    lines.push(`- ${selection.dimension} (${selection.level}): ${selection.pattern}`);
  }
  if (interactionPatterns.length > 0) {
    lines.push("");
    lines.push("[INTERACTION GUIDANCE]");
    for (const interaction of interactionPatterns) {
      lines.push(`- ${interaction.id}: ${interaction.pattern}`);
    }
  }
  lines.push("");
  lines.push("[VOCABULARY]");
  if (asArray(vocabulary.preferred_terms).length > 0) {
    lines.push(`Preferred terms: ${asArray(vocabulary.preferred_terms).join("; ")}`);
  } else {
    lines.push("Preferred terms: (none)");
  }
  if (safeForbidden.filteredForbidden.length > 0) {
    lines.push(`Forbidden terms: ${safeForbidden.filteredForbidden.join("; ")}`);
  } else {
    lines.push("Forbidden terms: (none)");
  }
  lines.push(`Protected refusal terms (always available): ${PROTECTED_REFUSAL_TERMS.join("; ")}`);
  lines.push("");
  lines.push("[BEHAVIORAL RULES]");
  const rules = asArray(profile.behavioral_rules);
  if (rules.length === 0) {
    lines.push("- (none)");
  } else {
    for (const rule of rules) {
      lines.push(`- ${rule}`);
    }
  }

  if (contextResolution.matched.length > 0) {
    lines.push("");
    lines.push("[ACTIVE CONTEXT]");
    lines.push(
      `Matched: ${contextResolution.matched
        .map((item) => `${item.when}${item.priority != null ? ` (priority ${item.priority})` : ""}`)
        .join(", ")}`
    );
  }

  lines.push("");
  lines.push(safetyFloor);

  return {
    text: lines.join("\n"),
    restoredProtectedTerms: safeForbidden.restoredProtectedTerms,
    patternSelections,
    interactionPatterns
  };
}

export function compileResolvedProfile(profile, options = {}) {
  const model = String(options.model ?? "claude-sonnet");
  const context = options.context ?? {};
  const explain = Boolean(options.explain);

  const { profile: effectiveProfile, contextResolution } = applyContextAdjustments(profile, context);
  const rendered = renderPersonalityText(effectiveProfile, model, contextResolution, options);
  const placement = selectPlacement(model);
  const text = rendered.text;

  const compiled = {
    text,
    placement,
    metadata: {
      profile: effectiveProfile?.meta?.name ?? "unknown",
      version: effectiveProfile?.meta?.version ?? "unknown",
      schema_version: effectiveProfile?.schema ?? "unknown",
      model_target: model,
      token_count: estimateTokenCount(text),
      safety_floor_included: true,
      adaptive_dimensions: collectAdaptiveDimensions(effectiveProfile.voice),
      humor_style:
        effectiveProfile?.voice?.humor && typeof effectiveProfile.voice.humor === "object"
          ? effectiveProfile.voice.humor.style ?? null
          : null,
      compilation_timestamp: new Date().toISOString()
    }
  };

  if (explain) {
    compiled.trace = {
      context_matches: contextResolution.matched.map((item) => item.when),
      adjustments_applied: contextResolution.resolvedAdjustments,
      inject_rules: contextResolution.injectRules,
      protected_refusal_terms_restored: rendered.restoredProtectedTerms,
      pattern_selections: rendered.patternSelections,
      interaction_patterns: rendered.interactionPatterns
    };
  }

  return compiled;
}

export function compileProfile(profilePath, options = {}) {
  const strict = Boolean(options.strict);
  const validation = validateProfile(profilePath, {
    strict,
    bundledProfilesDir: options.bundledProfilesDir
  });

  if (validation.effectiveErrors.length > 0) {
    const error = new Error("Profile failed validation and cannot be compiled.");
    error.code = "E_COMPILE_VALIDATION";
    error.validation = validation;
    throw error;
  }

  const compiled = compileResolvedProfile(validation.profile, options);
  compiled.validation = {
    warnings: validation.warnings,
    errors: validation.errors,
    strict
  };
  return compiled;
}
