# `@traits-dev/core` API Reference

Public API surface exported from `@traits-dev/core`.

## Profile operations

- `loadProfileFile(profilePath)`
- `resolveExtends(profilePath, options?)`
- `resolveActiveContext(profile, context?)`
- `normalizeProfile(profilePath, options?)`

## Validation

- `validateProfile(profilePath, options?)`
- `validateResolvedProfile(profile, options?)`

## Compilation

- `compileProfile(profilePath, options?)`
- `compileResolvedProfile(profile, options?)`
- `injectPersonality(basePrompt, compiled, options?)`

## Evaluation

- `validateEvalScenario(scenario)`
- `validateEvalScenarios(scenarios)`
- `evaluateTier1Response(sample, options?)`
- `runTier1Evaluation(samples, options?)`
- `runTier1EvaluationForProfile(profilePath, samples, options?)`
- `runTier2Evaluation(samples, options?)`
- `runTier2EvaluationForProfile(profilePath, samples, options?)`
- `runTier3Evaluation(samples, options?)`
- `runTier3EvaluationForProfile(profilePath, samples, options?)`

## Import

- `runImportAnalysis(promptInput, options?)`

## Public types

- `PersonalityProfile`
- `ContextAdaptation`
- `ContextResolution`
- `ValidationDiagnostic`
- `ValidationResult`
- `CompiledPersonality`
- `ExtendsDiagnostics`
- `ExtendsResult`
- `VocabularyConstraints`
- `Level`
- `DimensionName`
- `DimensionShorthand`
- `DimensionObject`
- `DimensionValue`
- `HumorStyle`
- `HumorDimensionObject`
- `HumorDimensionValue`
- `CompileOptions`
- `EvalSample`
- `Tier1Options`
- `Tier2Options`
- `Tier3Options`
- `ImportOptions`

## Internal API boundary

- External consumers: `@traits-dev/core`
- Monorepo tooling/internal helpers: `@traits-dev/core/internal`
