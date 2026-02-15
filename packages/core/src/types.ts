export type Level = "very-low" | "low" | "medium" | "high" | "very-high";

export type DimensionName =
  | "formality"
  | "warmth"
  | "verbosity"
  | "directness"
  | "empathy"
  | "humor";

export type HumorStyle = "none" | "dry" | "subtle-wit" | "playful";

export type DimensionShorthand = Level;

export type DimensionObject = {
  target: Level;
  adapt?: boolean;
  floor?: Level;
  ceiling?: Level;
};

export type HumorDimensionObject = DimensionObject & {
  style?: HumorStyle;
};

export type DimensionValue = DimensionShorthand | DimensionObject;
export type HumorDimensionValue = DimensionShorthand | HumorDimensionObject;

export interface VocabularyConstraints {
  preferred_terms?: string[];
  forbidden_terms?: string[];
  preferred_terms_remove?: string[];
  forbidden_terms_remove?: string[];
}

export interface ContextAdaptation {
  when: string;
  adjustments?: Partial<Record<DimensionName, DimensionValue | HumorDimensionValue>>;
  inject?: string[];
  priority?: number;
}

export interface CapabilityHandoff {
  trigger: string;
  action: string;
}

export interface ProfileCapabilities {
  tools: string[];
  constraints: string[];
  handoff: CapabilityHandoff;
}

export interface PersonalityProfile {
  schema: string;
  meta: {
    name: string;
    version: string;
    description: string;
    tags?: string[];
    target_audience?: string;
    [key: string]: unknown;
  };
  identity: {
    role: string;
    backstory?: string;
    expertise_domains?: string[];
    [key: string]: unknown;
  };
  voice: {
    formality: DimensionValue;
    warmth: DimensionValue;
    verbosity: DimensionValue;
    directness: DimensionValue;
    empathy: DimensionValue;
    humor: HumorDimensionValue;
    [key: string]: DimensionValue | HumorDimensionValue | undefined;
  };
  vocabulary?: VocabularyConstraints;
  behavioral_rules?: string[];
  context_adaptations?: ContextAdaptation[];
  capabilities?: ProfileCapabilities;
  localization?: Record<string, unknown>;
  channel_adaptations?: Record<string, unknown>;
  extends?: string;
  behavioral_rules_remove?: string[];
  context_adaptations_remove?: string[];
  [key: string]: unknown;
}

export interface ValidationDiagnostic {
  code: string;
  severity: "warning" | "error";
  message: string;
  location?: string;
  promotedFrom?: string;
  details?: unknown;
}

export interface ValidationCheckSummary {
  status: "pass" | "warning" | "error";
  errors: number;
  warnings: number;
}

export interface ValidationResult {
  profilePath?: string;
  parentPath: string | null;
  profile: PersonalityProfile | null;
  strict: boolean;
  warnings: ValidationDiagnostic[];
  errors: ValidationDiagnostic[];
  promotedWarnings: ValidationDiagnostic[];
  effectiveErrors: ValidationDiagnostic[];
  constraintCount: number;
  constraintBreakdown: {
    behavioral_rules: number;
    vocabulary_preferred_terms: number;
    vocabulary_forbidden_terms: number;
    context_adaptations: number;
    [key: string]: number;
  };
  checks: Record<string, ValidationCheckSummary>;
  isValid: boolean;
  exitCode: number;
}

export interface CompiledPersonality {
  text: string;
  placement: {
    model: string;
    recommended_position: "start" | "after_tools" | "end";
    rationale: string;
  };
  metadata: {
    profile: string;
    version: string;
    schema_version: string;
    model_target: string;
    token_count: number;
    safety_floor_included: boolean;
    adaptive_dimensions: string[];
    humor_style: string | null;
    compilation_timestamp: string;
  };
  trace?: {
    context_matches: string[];
    adjustments_applied: Record<string, unknown>;
    inject_rules: string[];
    protected_refusal_terms_restored: string[];
    pattern_selections: unknown[];
    interaction_patterns: unknown[];
  };
  validation?: {
    warnings: ValidationDiagnostic[];
    errors: ValidationDiagnostic[];
    strict: boolean;
  };
}

export interface ExtendsDiagnostics {
  warnings: ValidationDiagnostic[];
  errors: ValidationDiagnostic[];
}

export interface ExtendsResult {
  profile: PersonalityProfile;
  parentPath: string | null;
  diagnostics: ExtendsDiagnostics;
}

export interface ContextResolution {
  matched: ContextAdaptation[];
  resolvedAdjustments: Record<string, DimensionValue>;
  injectRules: string[];
}
