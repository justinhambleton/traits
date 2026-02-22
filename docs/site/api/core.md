# `@traits-dev/core` API Reference

Public, semver-tracked surface exported from `@traits-dev/core`.

> **Terminology note:** The SDK uses `PersonalityProfile` as its core type name. This represents a voice and behavioral policy profile. The name is locked by semver; all documentation uses "policy profile" in prose.

## Install

```bash
npm i @traits-dev/core
```

Related package APIs:

- [`@traits-dev/vercel`](/api/vercel) for Vercel AI SDK middleware wrapping
- [`@traits-dev/mcp`](/api/mcp) for MCP tools/resources integration

## Profile operations

### `loadProfileFile`

Parse a YAML profile from disk.

```ts
loadProfileFile(profilePath: string): PersonalityProfile
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `profilePath` | `string` | Absolute or relative path to a `.yaml` profile |

**Returns:** Parsed `PersonalityProfile` object.

```ts
import { loadProfileFile } from "@traits-dev/core";
const profile = loadProfileFile("profiles/resolve.yaml");
```

### `resolveExtends`

Resolve parent profiles recursively and return the merged result with diagnostics. Supports multi-level inheritance chains with cycle detection and configurable depth limits.

```ts
resolveExtends(
  profilePath: string,
  options?: {
    bundledProfilesDir?: string;
    maxExtendsDepth?: number;
  }
): ExtendsResult
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `profilePath` | `string` | Path to the child profile |
| `options.bundledProfilesDir` | `string?` | Directory for bundled starter profiles |
| `options.maxExtendsDepth` | `number?` | Maximum chain depth (default: 5) |

**Returns:** `ExtendsResult` with `profile` (merged), `parentPaths`, and `diagnostics`.

Diagnostics may include:

- `E_EXTENDS_CYCLE` — circular reference in extends chain
- `E_EXTENDS_DEPTH` — chain exceeds max depth

### `resolveActiveContext`

Resolve active context adaptations and return resulting adjustments and injected rules.

```ts
resolveActiveContext(
  profile: PersonalityProfile,
  context?: Record<string, unknown>
): ContextResolution
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `profile` | `PersonalityProfile` | Resolved profile object |
| `context` | `Record<string, unknown>?` | Runtime context key-value pairs |

**Returns:** `ContextResolution` with matched adaptations, merged adjustments, and collected inject rules.

```ts
import { loadProfileFile, resolveActiveContext } from "@traits-dev/core";
const profile = loadProfileFile("profiles/resolve.yaml");
const ctx = resolveActiveContext(profile, { frustrated_user: true });
```

### `normalizeProfile`

Convenience wrapper that resolves extends and returns the final profile.

```ts
normalizeProfile(
  profilePath: string,
  options?: { bundledProfilesDir?: string }
): PersonalityProfile
```

## Validation

### `validateProfile`

End-to-end validation from file path, including extends resolution.

```ts
validateProfile(
  profilePath: string,
  options?: { strict?: boolean; bundledProfilesDir?: string }
): ValidationResult
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `profilePath` | `string` | Path to the profile |
| `options.strict` | `boolean?` | Promote warnings to errors |
| `options.bundledProfilesDir` | `string?` | Directory for bundled starter profiles |

**Returns:** `ValidationResult` with `diagnostics`, `effectiveErrors`, `effectiveWarnings`, and `profile`.

```ts
import { validateProfile } from "@traits-dev/core";
const result = validateProfile("my-agent.yaml", { strict: true });
if (result.effectiveErrors.length > 0) {
  console.error("Validation failed:", result.effectiveErrors);
}
```

### `validateResolvedProfile`

Validate a profile object that is already loaded/resolved.

```ts
validateResolvedProfile(
  profile: PersonalityProfile,
  options?: { strict?: boolean }
): ValidationResult
```

## Compilation

### `compileProfile`

Validate and compile a file-based profile into a model-specific system prompt.

```ts
compileProfile(
  profilePath: string,
  options?: CompileOptions
): CompiledPersonality
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `profilePath` | `string` | Path to the profile |
| `options.model` | `string?` | Target model (e.g., `"gpt-4o"`, `"claude-sonnet-4"`) |
| `options.context` | `Record<string, unknown>?` | Runtime context for adaptations |
| `options.explain` | `boolean?` | Include compilation trace |
| `options.strict` | `boolean?` | Treat validation warnings as errors |
| `options.bundledProfilesDir` | `string?` | Bundled profiles directory |
| `options.knowledgeBaseDir` | `string?` | Custom knowledge base patterns |

**Returns:** `CompiledPersonality` with `text`, `placement`, and `metadata`.

```ts
import { compileProfile } from "@traits-dev/core";

const compiled = compileProfile("profiles/resolve.yaml", { model: "gpt-4o" });
console.log(compiled.text);                              // System prompt string
console.log(compiled.placement.recommended_position);    // "after_tools"
console.log(compiled.metadata.token_count);              // Token estimate
```

### `compileResolvedProfile`

Compile a profile object directly (skips file loading).

```ts
compileResolvedProfile(
  profile: PersonalityProfile,
  options?: CompileOptions
): CompiledPersonality
```

### `injectPersonality`

Inject compiled policy text into an existing system prompt with model-aware placement.

```ts
injectPersonality(args: {
  compiledPersonality: string | Pick<CompiledPersonality, "text" | "placement">
  system?: string
  model?: string
}): string
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `compiledPersonality` | `string \| { text, placement }` | Compiled text or object |
| `system` | `string?` | Existing system prompt to merge with |
| `model` | `string?` | Model for placement heuristics |

**Returns:** Merged system prompt string.

```ts
import { compileProfile, injectPersonality } from "@traits-dev/core";

const compiled = compileProfile("my-agent.yaml", { model: "gpt-4o" });
const system = injectPersonality({
  compiledPersonality: compiled,
  system: "You are a helpful assistant with access to order tools.",
  model: "gpt-4o"
});
```

## Evaluation

### `evaluateTier1Response`

Score a single response against a profile using Tier 1 deterministic checks.

```ts
evaluateTier1Response(
  profile: PersonalityProfile,
  responseText: string,
  options?: Tier1Options
): {
  score: number;
  checks: {
    vocabulary: {
      preferred_total: number;
      preferred_matched: number;
      preferred_coverage: number;
      forbidden_total: number;
      forbidden_matched: number;
      pass: boolean;
    };
    structure: {
      behavioral_rule_count: number;
      response_non_empty: boolean;
      pass: boolean;
    };
    helpfulness: {
      char_count: number;
      pass: boolean;
      skipped: boolean;
    };
    dimensions: {
      alignment_score: number;
      per_dimension: Array<{
        dimension: string;
        target: string;
        aligned_signals: number;
        counter_signals: number;
        score: number;
      }>;
    };
  };
}
```

### `runTier1Evaluation`

Run Tier 1 across multiple samples.

```ts
runTier1Evaluation(
  profile: PersonalityProfile,
  samples: EvalSample[],
  options?: Tier1Options
): {
  tier: 1;
  sample_count: number;
  average_score: number;
  samples: Array<{ id: string; score: number; checks: /* same as above */ }>;
}
```

### `runTier1EvaluationForProfile`

Validate and evaluate from a file path.

```ts
runTier1EvaluationForProfile(
  profilePath: string,
  samples: EvalSample[],
  options?: Tier1Options
): { validation: ValidationResult; report: /* same as runTier1Evaluation */ }
```

### `runTier2Evaluation` / `runTier2EvaluationForProfile`

Tier 2 embedding-based evaluation. Async — requires API key.

```ts
runTier2Evaluation(
  profile: PersonalityProfile,
  samples: EvalSample[],
  options?: Tier2Options
): Promise<{ tier: 2; sample_count: number; average_score: number; samples: Array<...> }>
```

### `runTier3Evaluation` / `runTier3EvaluationForProfile`

Tier 3 LLM judge evaluation. Async — requires API key.

```ts
runTier3Evaluation(
  profile: PersonalityProfile,
  samples: EvalSample[],
  options?: Tier3Options
): Promise<{ tier: 3; sample_count: number; average_score: number; samples: Array<...> }>
```

### `validateEvalScenario` / `validateEvalScenarios`

Validate eval sample structure before running evaluation.

```ts
validateEvalScenario(scenario: unknown): { valid: boolean; errors: string[] }

validateEvalScenarios(scenarios: unknown): {
  valid: boolean;
  count: number;
  invalid: Array<{ index: number; id: string | null; errors: string[] }>;
}
```

## Import

### `runImportAnalysis`

Convert an existing system prompt into a structured profile using LLM analysis.

```ts
runImportAnalysis(
  promptText: string,
  options?: ImportOptions
): Promise<{
  provider: string;
  analysis: Record<string, unknown>;
  profile: PersonalityProfile;
  yaml: string;
}>
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `promptText` | `string` | Existing system prompt text |
| `options.provider` | `string?` | `"auto"`, `"openai"`, or `"anthropic"` |
| `options.model` | `string?` | Override analysis model |
| `options.profileName` | `string?` | Output profile name |

```ts
import { runImportAnalysis } from "@traits-dev/core";

const result = await runImportAnalysis(existingPrompt, {
  provider: "openai",
  profileName: "migrated-agent"
});
console.log(result.yaml); // Generated YAML profile
```

## Diff

### `diffProfiles`

Compare two profile objects structurally and return a list of changes.

```ts
diffProfiles(
  profileA: PersonalityProfile,
  profileB: PersonalityProfile
): ProfileDiff
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `profileA` | `PersonalityProfile` | Base profile |
| `profileB` | `PersonalityProfile` | Comparison profile |

**Returns:** `ProfileDiff` with `changes` array and `summary`.

```ts
import { diffProfiles, loadProfileFile, resolveExtends } from "@traits-dev/core";

const a = resolveExtends("profiles/resolve.yaml", { bundledProfilesDir: "profiles" }).profile;
const b = resolveExtends("profiles/haven.yaml", { bundledProfilesDir: "profiles" }).profile;
const diff = diffProfiles(a, b);

console.log(diff.summary); // { added: 3, removed: 1, modified: 5 }
for (const change of diff.changes) {
  console.log(`${change.type}: ${change.path}`);
}
```

Each `DiffEntry` has:

- `path` — dotted path (e.g., `voice.formality`, `behavioral_rules[]`, `context_adaptations[vip_user]`)
- `type` — `"added"`, `"removed"`, or `"modified"`
- `oldValue` / `newValue` — the values that changed

## Option types

### `CompileOptions`

```ts
type CompileOptions = {
  model?: string;
  context?: Record<string, unknown>;
  explain?: boolean;
  strict?: boolean;
  bundledProfilesDir?: string;
  knowledgeBaseDir?: string;
}
```

### `Tier1Options`

```ts
type Tier1Options = {
  includeHelpfulness?: boolean;
  strict?: boolean;
  bundledProfilesDir?: string;
}
```

### `Tier2Options`

```ts
type Tier2Options = {
  includeHelpfulness?: boolean;
  strict?: boolean;
  bundledProfilesDir?: string;
  openaiApiKey?: string;
  embeddingModel?: string;
  openaiBaseUrl?: string;
  fetchImpl?: typeof fetch;
  fetchTimeoutMs?: number;
  fetchMaxRetries?: number;
  fetchRetryBaseMs?: number;
  embeddingFn?: (text: string) => Promise<number[]>;
  knowledgeBaseDir?: string;
  modelTarget?: string;
}
```

### `Tier3Options`

```ts
type Tier3Options = {
  includeHelpfulness?: boolean;
  strict?: boolean;
  bundledProfilesDir?: string;
  provider?: string;
  judgeFn?: (args: { systemPrompt: string; userPrompt: string }) => Promise<string>;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  judgeModel?: string;
  openaiBaseUrl?: string;
  anthropicBaseUrl?: string;
  fetchImpl?: typeof fetch;
  fetchTimeoutMs?: number;
  fetchMaxRetries?: number;
  fetchRetryBaseMs?: number;
}
```

### `EvalSample`

```ts
type EvalSample = {
  id?: string;
  prompt?: string;
  response?: string;
}
```

### `ImportOptions`

```ts
type ImportOptions = {
  provider?: string;
  analysisFn?: (args: { systemPrompt: string; userPrompt: string }) => Promise<unknown>;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  model?: string;
  openaiBaseUrl?: string;
  anthropicBaseUrl?: string;
  fetchImpl?: typeof fetch;
  fetchTimeoutMs?: number;
  fetchMaxRetries?: number;
  fetchRetryBaseMs?: number;
  profileName?: string;
  description?: string;
}
```

## Schema types

Exported types for TypeScript consumers:

`Level`, `DimensionName`, `HumorStyle`, `DimensionShorthand`, `DimensionObject`, `HumorDimensionObject`, `DimensionValue`, `HumorDimensionValue`, `VocabularyConstraints`, `ContextAdaptation`, `LockedRule`, `RuleConstraint`, `CapabilityHandoff`, `ProfileCapabilities`, `PersonalityProfile`, `ValidationDiagnostic`, `ValidationResult`, `CompiledPersonality`, `ExtendsDiagnostics`, `ExtendsResult`, `ContextResolution`, `ProfileDiff`, `DiffEntry`.

## Internal boundary

1. External consumers import from `@traits-dev/core`.
2. Monorepo tooling that needs non-public helpers uses `@traits-dev/core/internal`.
