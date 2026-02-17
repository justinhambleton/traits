# `@traits-dev/vercel` API Reference

Vercel AI SDK integration package for traits.dev.

Use `withPersonality()` to wrap any `LanguageModelV3` and inject personality policy automatically.

## Install

```bash
npm i @traits-dev/vercel ai
```

Peer dependencies:

- `ai` `>=5.0.0`
- `@traits-dev/core` `>=0.7.0`

## Primary API

### `withPersonality`

```ts
withPersonality(
  model: LanguageModelV3,
  profile: string | PersonalityProfile,
  options?: WithPersonalityOptions
): LanguageModelV3
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `model` | `LanguageModelV3` | Vercel AI SDK model instance to wrap |
| `profile` | `string \| PersonalityProfile` | Profile path (`.yaml`) or preloaded object |
| `options.model` | `string?` | Override model detection used during compile |
| `options.context` | `Record<string, unknown>?` | Runtime context for `context_adaptations` |
| `options.strict` | `boolean?` | Promote validation warnings to compile errors |
| `options.bundledProfilesDir` | `string?` | Bundled starter profiles directory override |
| `options.knowledgeBaseDir` | `string?` | Knowledge base directory override |

**Returns:** Wrapped `LanguageModelV3` usable with `generateText`, `streamText`, and related APIs.

## Behavior contract

- Compiles eagerly once when `withPersonality()` is called (fail-fast).
- Reuses compiled output per request (no per-request compile cost).
- Prepends a system message when none exists.
- Merges with existing system message content when one exists.
- Auto-detects model family from `model.modelId`:
  - Claude -> `"claude"`
  - GPT / `o1` / `o3` / `o4` -> `"gpt"`
  - Fallback -> raw `modelId`

## Usage examples

### File-path profile

```ts
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { withPersonality } from "@traits-dev/vercel";

const model = withPersonality(
  openai("gpt-4o"),
  "profiles/resolve.yaml",
  { strict: true, bundledProfilesDir: "profiles" }
);

const result = await generateText({
  model,
  prompt: "Please help me fix a double charge."
});
```

### Preloaded object profile

```ts
import { withPersonality } from "@traits-dev/vercel";
import { openai } from "@ai-sdk/openai";

const profile = {
  schema: "v1.6",
  meta: { name: "Team Policy", version: "1.0", description: "Support profile" },
  identity: { role: "Customer support assistant" },
  voice: {
    formality: "medium",
    warmth: "high",
    verbosity: "low",
    directness: "high",
    empathy: "high",
    humor: "low"
  }
};

const model = withPersonality(openai("gpt-4o"), profile, {
  model: "gpt-4o"
});
```

## Advanced exports

`@traits-dev/vercel` also exports:

- `compileEagerly(profile, modelId, options?)`
- `createPersonalityMiddleware(compiled)`

Use these only when you need lower-level control than `withPersonality()`.
