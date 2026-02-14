export {
  loadProfileFile,
  resolveExtends,
  resolveActiveContext,
  normalizeProfile
} from "./profile.js";

export type {
  CompiledPersonality,
  ContextAdaptation,
  ContextResolution,
  DimensionName,
  DimensionObject,
  DimensionShorthand,
  DimensionValue,
  ExtendsDiagnostics,
  ExtendsResult,
  HumorDimensionObject,
  HumorDimensionValue,
  HumorStyle,
  Level,
  PersonalityProfile,
  ValidationDiagnostic,
  ValidationResult,
  VocabularyConstraints
} from "./types.js";

export { validateProfile, validateResolvedProfile } from "./validator/engine.js";
export { compileProfile, compileResolvedProfile } from "./compiler/engine.js";
export type { CompileOptions } from "./compiler/engine.js";
export { injectPersonality } from "./inject/inject.js";

export {
  validateEvalScenario,
  validateEvalScenarios
} from "./eval/types.js";
export type { EvalSample } from "./eval/types.js";
export {
  evaluateTier1Response,
  runTier1Evaluation,
  runTier1EvaluationForProfile
} from "./eval/tier1.js";
export type { Tier1Options } from "./eval/tier1.js";
export { runTier2Evaluation, runTier2EvaluationForProfile } from "./eval/tier2.js";
export type { Tier2Options } from "./eval/tier2.js";
export { runTier3Evaluation, runTier3EvaluationForProfile } from "./eval/tier3.js";
export type { Tier3Options } from "./eval/tier3.js";

export { runImportAnalysis } from "./import/engine.js";
export type { ImportOptions } from "./import/engine.js";
