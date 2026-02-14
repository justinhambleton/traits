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
export {
  formatValidationResult,
  toValidationResultObject
} from "./validator/format.js";

export { compileProfile, compileResolvedProfile } from "./compiler/engine.js";
export {
  applyCalibrationUpdates,
  mergeCalibrationFile
} from "./compiler/calibration.js";
export { injectPersonality } from "./inject/inject.js";
export { validateEvalScenario, validateEvalScenarios } from "./eval/types.js";
export {
  detectEvalTierAvailability,
  resolveTierExecution
} from "./eval/tier-detection.js";
export { runOfflineBaselineScaffold } from "./eval/baselines.js";
export {
  evaluateTier1Response,
  runTier1Evaluation,
  runTier1EvaluationForProfile
} from "./eval/tier1.js";
export { runTier2Evaluation, runTier2EvaluationForProfile } from "./eval/tier2.js";
export { runTier3Evaluation, runTier3EvaluationForProfile } from "./eval/tier3.js";
export { anthropicJudge } from "./eval/providers/anthropic.js";
export { openAIEmbed, openAIJudge } from "./eval/providers/openai.js";
export {
  mapImportAnalysisToProfile,
  renderImportedProfileYAML,
  runImportAnalysis
} from "./import/engine.js";
