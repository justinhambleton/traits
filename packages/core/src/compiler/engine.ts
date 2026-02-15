import { resolveActiveContext } from "../profile.js";
import {
  asArray,
  clone,
  isClaudeModel,
  isGptModel,
  normalizeRuleConstraints,
  PROTECTED_REFUSAL_TERMS
} from "../utils.js";
import { validateProfile } from "../validator/engine.js";
import { selectInteractionPatterns, selectPatterns } from "./patterns.js";
import { getSafetyFloor } from "./safety-floor.js";
import type {
  CompiledPersonality,
  ContextResolution,
  DimensionValue,
  PersonalityProfile,
  RuleConstraint
} from "../types.js";

export type CompileOptions = {
  model?: string;
  context?: Record<string, unknown>;
  explain?: boolean;
  strict?: boolean;
  bundledProfilesDir?: string;
  knowledgeBaseDir?: string;
};

function selectPlacement(model: string): CompiledPersonality["placement"] {
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

function stringifyDimensionTarget(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    return String((value as { target?: unknown }).target ?? "medium");
  }
  return "medium";
}

function applyContextAdjustments(
  profile: PersonalityProfile,
  context: Record<string, unknown> = {}
): { profile: PersonalityProfile; contextResolution: ContextResolution } {
  const resolved = resolveActiveContext(profile, context);
  const effective = clone(profile) as PersonalityProfile;
  effective.voice = effective.voice ?? {};
  for (const [dimension, adjustment] of Object.entries(resolved.resolvedAdjustments)) {
    effective.voice[dimension] = clone(adjustment) as DimensionValue;
  }

  const behavioralRules = [
    ...asArray<RuleConstraint>(effective.behavioral_rules),
    ...resolved.injectRules
  ];
  effective.behavioral_rules = behavioralRules;
  return {
    profile: effective,
    contextResolution: resolved
  };
}

function enforceProtectedVocabulary(forbiddenTerms: unknown): {
  filteredForbidden: string[];
  restoredProtectedTerms: string[];
} {
  const protectedLower = new Set(PROTECTED_REFUSAL_TERMS.map((term) => term.toLowerCase()));
  const restored: string[] = [];
  const filteredForbidden: string[] = [];

  for (const term of asArray<string>(forbiddenTerms)) {
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

function estimateTokenCount(text: string): number {
  const wordCount = String(text).trim().split(/\s+/).filter(Boolean).length;
  return Math.ceil(wordCount * 1.3);
}

function collectAdaptiveDimensions(voice: Record<string, unknown> = {}): string[] {
  const adaptive: string[] = [];
  for (const [dimension, value] of Object.entries(voice)) {
    if (
      value &&
      typeof value === "object" &&
      (value as { adapt?: unknown }).adapt === true
    ) {
      adaptive.push(dimension);
    }
  }
  return adaptive;
}

function renderPersonalityText(
  profile: PersonalityProfile,
  model: string,
  contextResolution: ContextResolution,
  compileOptions: CompileOptions = {}
): {
  text: string;
  restoredProtectedTerms: string[];
  patternSelections: unknown[];
  interactionPatterns: unknown[];
} {
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

  const lines: string[] = [];
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
  if (asArray<string>(vocabulary.preferred_terms).length > 0) {
    lines.push(`Preferred terms: ${asArray<string>(vocabulary.preferred_terms).join("; ")}`);
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
  const rules = normalizeRuleConstraints(profile.behavioral_rules).map((entry) => entry.rule);
  if (rules.length === 0) {
    lines.push("- (none)");
  } else {
    for (const rule of rules) {
      lines.push(`- ${rule}`);
    }
  }

  if ((profile.schema === "v1.5" || profile.schema === "v1.6") && profile.capabilities) {
    const capabilities = profile.capabilities;
    const tools = asArray<string>(capabilities.tools);
    const constraints = normalizeRuleConstraints(capabilities.constraints).map(
      (entry) => entry.rule
    );

    lines.push("");
    lines.push("[CAPABILITY BOUNDARIES]");
    lines.push(
      `Tools: ${tools.length > 0 ? tools.join("; ") : "(none — advisory only, no side-effect tools configured)"}`
    );
    lines.push("Constraints:");
    if (constraints.length === 0) {
      lines.push("- (none)");
    } else {
      for (const constraint of constraints) {
        lines.push(`- ${constraint}`);
      }
    }
    lines.push(`Handoff trigger: ${capabilities.handoff.trigger}`);
    lines.push(`Handoff action: ${capabilities.handoff.action}`);
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

export function compileResolvedProfile(
  profile: PersonalityProfile,
  options: CompileOptions = {}
): CompiledPersonality {
  const model = String(options.model ?? "claude-sonnet");
  const context = options.context ?? {};
  const explain = Boolean(options.explain);

  const { profile: effectiveProfile, contextResolution } = applyContextAdjustments(profile, context);
  const rendered = renderPersonalityText(effectiveProfile, model, contextResolution, options);
  const placement = selectPlacement(model);
  const text = rendered.text;

  const compiled: CompiledPersonality = {
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

export function compileProfile(
  profilePath: string,
  options: CompileOptions = {}
): CompiledPersonality {
  const strict = Boolean(options.strict);
  const validation = validateProfile(profilePath, {
    strict,
    bundledProfilesDir: options.bundledProfilesDir
  });

  if (validation.effectiveErrors.length > 0) {
    const error = new Error("Profile failed validation and cannot be compiled.");
    (error as Error & { code?: string; validation?: unknown }).code = "E_COMPILE_VALIDATION";
    (error as Error & { code?: string; validation?: unknown }).validation = validation;
    throw error;
  }

  if (!validation.profile) {
    const error = new Error("Profile failed validation and cannot be compiled.");
    (error as Error & { code?: string; validation?: unknown }).code = "E_COMPILE_VALIDATION";
    (error as Error & { code?: string; validation?: unknown }).validation = validation;
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
