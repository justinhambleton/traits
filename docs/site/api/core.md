# `@traits-dev/core` API Reference

Public, semver-tracked surface exported from `@traits-dev/core`.

## Install

```bash
pnpm add @traits-dev/core
```

## Profile operations

```ts
loadProfileFile(profilePath: string): PersonalityProfile
resolveExtends(profilePath: string, options?: { bundledProfilesDir?: string }): ExtendsResult
resolveActiveContext(profile: PersonalityProfile, context?: Record<string, unknown>): ContextResolution
normalizeProfile(profilePath: string, options?: { bundledProfilesDir?: string }): PersonalityProfile
```

1. `loadProfileFile`: Parse YAML profile from disk.
2. `resolveExtends`: Resolve parent profile and return merged profile + diagnostics.
3. `resolveActiveContext`: Resolve active context adaptations and resulting adjustments/injected rules.
4. `normalizeProfile`: Convenience wrapper for resolved profile output.

## Validation

```ts
validateProfile(
  profilePath: string,
  options?: { strict?: boolean; bundledProfilesDir?: string }
): ValidationResult

validateResolvedProfile(
  profile: PersonalityProfile,
  options?: { strict?: boolean }
): ValidationResult
```

1. `validateProfile`: End-to-end validate from file path (including extends).
2. `validateResolvedProfile`: Validate a profile object that is already loaded/resolved.

## Compilation

```ts
compileProfile(profilePath: string, options?: CompileOptions): CompiledPersonality
compileResolvedProfile(profile: PersonalityProfile, options?: CompileOptions): CompiledPersonality
injectPersonality(args: {
  compiledPersonality: string | Pick<CompiledPersonality, "text" | "placement">
  system?: string
  model?: string
}): string
```

1. `compileProfile`: Validate + compile a file-based profile.
2. `compileResolvedProfile`: Compile a profile object directly.
3. `injectPersonality`: Inject compiled text into an existing system prompt with model-aware placement.

Usage:

```ts
import { compileProfile } from "@traits-dev/core";

const compiled = compileProfile("profiles/resolve.yaml", { model: "gpt-4o" });
console.log(compiled.text);
```

## Evaluation

```ts
validateEvalScenario(scenario: unknown): { valid: boolean; errors: string[] }
validateEvalScenarios(scenarios: unknown): {
  valid: boolean
  count: number
  invalid: Array<{ index: number; id: string | null; errors: string[] }>
}
```

```ts
evaluateTier1Response(
  profile: PersonalityProfile,
  responseText: string,
  options?: Tier1Options
): { score: number; checks: unknown }

runTier1Evaluation(
  profile: PersonalityProfile,
  samples: EvalSample[],
  options?: Tier1Options
): { tier: 1; sample_count: number; average_score: number; samples: unknown[] }

runTier1EvaluationForProfile(
  profilePath: string,
  samples: EvalSample[],
  options?: Tier1Options
): { validation: ValidationResult; report: ReturnType<typeof runTier1Evaluation> }
```

```ts
runTier2Evaluation(
  profile: PersonalityProfile,
  samples: EvalSample[],
  options?: Tier2Options
): Promise<{ tier: 2; sample_count: number; average_score: number; samples: unknown[] }>

runTier2EvaluationForProfile(
  profilePath: string,
  samples: EvalSample[],
  options?: Tier2Options
): Promise<{ validation: ValidationResult; report: Awaited<ReturnType<typeof runTier2Evaluation>> }>
```

```ts
runTier3Evaluation(
  profile: PersonalityProfile,
  samples: EvalSample[],
  options?: Tier3Options
): Promise<{ tier: 3; sample_count: number; average_score: number; samples: unknown[] }>

runTier3EvaluationForProfile(
  profilePath: string,
  samples: EvalSample[],
  options?: Tier3Options
): Promise<{ validation: ValidationResult; report: Awaited<ReturnType<typeof runTier3Evaluation>> }>
```

## Import

```ts
runImportAnalysis(
  promptText: unknown,
  options?: ImportOptions
): Promise<{
  provider: string
  analysis: Record<string, unknown>
  profile: PersonalityProfile
  yaml: string
}>
```

Use this to derive a starter voice profile from an existing system prompt.

## Public option/sample types

```ts
type CompileOptions = {
  model?: string
  context?: Record<string, unknown>
  explain?: boolean
  strict?: boolean
  bundledProfilesDir?: string
  knowledgeBaseDir?: string
}

type Tier1Options = {
  includeHelpfulness?: boolean
  strict?: boolean
  bundledProfilesDir?: string
}

type Tier2Options = {
  includeHelpfulness?: boolean
  strict?: boolean
  bundledProfilesDir?: string
  openaiApiKey?: string
  embeddingModel?: string
  openaiBaseUrl?: string
  openAIBaseUrl?: string
  fetchImpl?: typeof fetch
  fetchTimeoutMs?: number
  fetchMaxRetries?: number
  fetchRetryBaseMs?: number
  embeddingFn?: (text: string) => Promise<number[]>
  knowledgeBaseDir?: string
  modelTarget?: string
}

type Tier3Options = {
  includeHelpfulness?: boolean
  strict?: boolean
  bundledProfilesDir?: string
  provider?: string
  judgeFn?: (args: { systemPrompt: string; userPrompt: string }) => Promise<string>
  openaiApiKey?: string
  anthropicApiKey?: string
  judgeModel?: string
  openaiBaseUrl?: string
  openAIBaseUrl?: string
  anthropicBaseUrl?: string
  fetchImpl?: typeof fetch
  fetchTimeoutMs?: number
  fetchMaxRetries?: number
  fetchRetryBaseMs?: number
}

type EvalSample = { id?: string; prompt?: string; response?: string }

type ImportOptions = {
  provider?: string
  analysisFn?: (args: { systemPrompt: string; userPrompt: string }) => Promise<unknown>
  openaiApiKey?: string
  anthropicApiKey?: string
  model?: string
  openaiBaseUrl?: string
  openAIBaseUrl?: string
  anthropicBaseUrl?: string
  fetchImpl?: typeof fetch
  fetchTimeoutMs?: number
  fetchMaxRetries?: number
  fetchRetryBaseMs?: number
  profileName?: string
  description?: string
}
```

## Public schema/result types

`Level`, `DimensionName`, `HumorStyle`, `DimensionShorthand`, `DimensionObject`, `HumorDimensionObject`, `DimensionValue`, `HumorDimensionValue`, `VocabularyConstraints`, `ContextAdaptation`, `CapabilityHandoff`, `ProfileCapabilities`, `PersonalityProfile`, `ValidationDiagnostic`, `ValidationResult`, `CompiledPersonality`, `ExtendsDiagnostics`, `ExtendsResult`, `ContextResolution`.

## Internal boundary

1. External consumers should import from `@traits-dev/core`.
2. Monorepo scripts/tooling that need non-public helpers should use `@traits-dev/core/internal`.
