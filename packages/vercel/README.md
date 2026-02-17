# @traits-dev/vercel

Vercel AI SDK middleware adapter for traits.dev profiles.

Wrap a `LanguageModelV3` once with `withPersonality()` to inject compiled personality policy automatically.

## Install

```bash
npm i @traits-dev/vercel ai
```

Peer dependencies:

- `ai` `>=5.0.0`
- `@traits-dev/core` `>=0.7.0`

## Usage

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
  prompt: "Please help with this billing issue."
});
```

## API

```ts
withPersonality(
  model: LanguageModelV3,
  profile: string | PersonalityProfile,
  options?: {
    model?: string;
    context?: Record<string, unknown>;
    strict?: boolean;
    bundledProfilesDir?: string;
    knowledgeBaseDir?: string;
  }
): LanguageModelV3
```

Behavior:

- Compile happens eagerly at wrapper creation time.
- Existing system prompts are merged; missing system prompts are prepended.
- Model family is auto-detected from `model.modelId` unless `options.model` is provided.

## Related docs

- Docs API: `docs/site/api/vercel.md`
- Integration guide: `docs/site/guides/integrations.md`
