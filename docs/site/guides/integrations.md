# Integration Recipes

Use these examples to place compiled voice policy text directly into the system prompt path of your stack.

## OpenAI Chat Completions API

```ts
import OpenAI from "openai";
import { compileProfile } from "@traits-dev/core";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const compiled = compileProfile("profiles/resolve.yaml", { model: "gpt-4o" });

const response = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    { role: "system", content: compiled.text },
    { role: "user", content: "You charged me twice this month." }
  ]
});
console.log(response.choices[0]?.message?.content ?? "");
```

## Anthropic Messages API

```ts
import Anthropic from "@anthropic-ai/sdk";
import { compileProfile } from "@traits-dev/core";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const compiled = compileProfile("profiles/haven.yaml", { model: "claude-sonnet-4" });

const result = await client.messages.create({
  model: "claude-sonnet-4-5",
  max_tokens: 600,
  system: compiled.text,
  messages: [{ role: "user", content: "I feel chest pain and shortness of breath." }]
});
console.log(result.content[0]?.type === "text" ? result.content[0].text : "");
```

## Vercel AI SDK (`generateText` / `streamText`)

```ts
import { openai } from "@ai-sdk/openai";
import { generateText, streamText } from "ai";
import { compileProfile } from "@traits-dev/core";

const compiled = compileProfile("profiles/architect.yaml", { model: "gpt-4o" });

const oneShot = await generateText({
  model: openai("gpt-4o-mini"),
  system: compiled.text,
  prompt: "Review this stack trace and propose a patch."
});

const stream = streamText({
  model: openai("gpt-4o-mini"),
  system: compiled.text,
  prompt: "Give me a strict triage plan for this incident."
});
```

## Multi-Agent Routing Pattern

```ts
import { compileProfile } from "@traits-dev/core";

const profileByRoute = {
  support: "profiles/resolve.yaml",
  healthcare: "profiles/haven.yaml",
  engineering: "profiles/architect.yaml"
} as const;

const route = classifyUserIntent(userMessage); // "support" | "healthcare" | "engineering"
const compiled = compileProfile(profileByRoute[route], { model: "gpt-4o" });

const system = `${compiled.text}\n\n[TOOL LOOP POLICY]\nOnly claim actions backed by tool output.`;
const assistantReply = await runAgentWithTools({ system, userMessage, tools });
```
