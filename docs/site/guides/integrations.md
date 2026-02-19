# Integration Recipes

Compiled policy text goes into the system prompt of your LLM call. These recipes show how.

## Recommended integration packages

Use these first if they fit your stack:

- `@traits-dev/vercel` for Vercel AI SDK middleware (`withPersonality`)
- `@traits-dev/mcp` for MCP-native tools/resources access

### `@traits-dev/vercel` (Vercel AI SDK middleware)

Install:

```bash
npm i @traits-dev/vercel ai
```

Wrap any `LanguageModelV3` once and use it with `generateText` or `streamText`:

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
  prompt: "You charged me twice. Help me resolve this."
});
```

`withPersonality()` compiles once at creation time, then injects or merges personality text into system messages on each request.

### `@traits-dev/mcp` (MCP server)

Run directly:

```bash
npx -y @traits-dev/mcp
```

Claude Desktop config:

```json
{
  "mcpServers": {
    "traits": {
      "command": "npx",
      "args": ["-y", "@traits-dev/mcp"]
    }
  }
}
```

MCP surface:

- Tools: `traits_validate`, `traits_compile`, `traits_list_profiles`
- Resources:
  - `traits://profiles`
  - `traits://profiles/{name}`
  - `traits://profiles/{name}/compiled/{model}`

Use tool calls for custom YAML content (`yaml` input), and resources for bundled starter profiles.

## OpenAI Chat Completions

```ts
import OpenAI from "openai";
import { compileProfile } from "@traits-dev/core";

const compiled = compileProfile("profiles/resolve.yaml", { model: "gpt-4o" });
const client = new OpenAI();

const response = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [
    { role: "system", content: compiled.text },
    { role: "user", content: "You charged me twice this month." }
  ]
});
console.log(response.choices[0]?.message?.content ?? "");
```

## OpenAI with tool calling

When using tools, place the compiled policy before or after tool definitions depending on the model. The compiler sets `compiled.placement.recommended_position` — for GPT models this is `"after_tools"`.

```ts
import OpenAI from "openai";
import { compileProfile } from "@traits-dev/core";

const compiled = compileProfile("profiles/resolve.yaml", { model: "gpt-4o" });
const client = new OpenAI();
const tools = [
  {
    type: "function" as const,
    function: {
      name: "lookup_order",
      description: "Retrieve order details by ID",
      parameters: {
        type: "object",
        properties: { order_id: { type: "string" } },
        required: ["order_id"]
      }
    }
  }
];

const response = await client.chat.completions.create({
  model: "gpt-4o",
  tools,
  messages: [
    { role: "system", content: compiled.text },
    { role: "user", content: "Can you check order #12345?" }
  ]
});
```

## Anthropic Messages API

For Claude models, the compiler recommends `"start"` placement via the `system` parameter.

```ts
import Anthropic from "@anthropic-ai/sdk";
import { compileProfile } from "@traits-dev/core";

const compiled = compileProfile("profiles/haven.yaml", { model: "claude-sonnet-4" });
const client = new Anthropic();

const result = await client.messages.create({
  model: "claude-sonnet-4-5",
  max_tokens: 600,
  system: compiled.text,
  messages: [{ role: "user", content: "I feel chest pain and shortness of breath." }]
});
console.log(result.content[0]?.type === "text" ? result.content[0].text : "");
```

## Anthropic with tool use

```ts
import Anthropic from "@anthropic-ai/sdk";
import { compileProfile } from "@traits-dev/core";

const compiled = compileProfile("profiles/haven.yaml", { model: "claude-sonnet-4" });
const client = new Anthropic();

const result = await client.messages.create({
  model: "claude-sonnet-4-5",
  max_tokens: 1024,
  system: compiled.text,
  tools: [
    {
      name: "check_symptoms",
      description: "Look up symptom information from medical knowledge base",
      input_schema: {
        type: "object",
        properties: { symptoms: { type: "array", items: { type: "string" } } },
        required: ["symptoms"]
      }
    }
  ],
  messages: [{ role: "user", content: "I have a persistent headache and dizziness." }]
});
```

## Vercel AI SDK (manual compile flow)

Works with `generateText` and `streamText`:

```ts
import { openai } from "@ai-sdk/openai";
import { generateText, streamText } from "ai";
import { compileProfile } from "@traits-dev/core";

const compiled = compileProfile("profiles/architect.yaml", { model: "gpt-4o" });

// One-shot
const result = await generateText({
  model: openai("gpt-4o"),
  system: compiled.text,
  prompt: "Review this stack trace and propose a patch."
});

// Streaming
const stream = streamText({
  model: openai("gpt-4o"),
  system: compiled.text,
  prompt: "Give me a strict triage plan for this incident."
});
```

## Multi-agent routing

Compile different profiles per route and append tool-loop policy:

```ts
import { compileProfile } from "@traits-dev/core";

const profileByRoute = {
  support: "profiles/resolve.yaml",
  healthcare: "profiles/haven.yaml",
  engineering: "profiles/architect.yaml"
} as const;

function agentSystem(route: keyof typeof profileByRoute, model: string): string {
  const compiled = compileProfile(profileByRoute[route], { model });
  return `${compiled.text}\n\n[TOOL LOOP POLICY]\nOnly claim actions backed by tool output.`;
}

const route = classifyUserIntent(userMessage);
const system = agentSystem(route, "gpt-4o");
const reply = await runAgentWithTools({ system, userMessage, tools });
```

## Context-adapted compilation

Activate context adaptations at compile time to adjust voice dimensions for specific situations:

```ts
import { compileProfile } from "@traits-dev/core";

// Standard compilation
const standard = compileProfile("my-agent.yaml", { model: "gpt-4o" });

// Compile with context — activates matching context_adaptations
const crisis = compileProfile("my-agent.yaml", {
  model: "gpt-4o",
  context: { frustrated_user: "true" }
});
```

The profile's `context_adaptations` with `when: "frustrated_user"` will activate, adjusting dimensions and injecting any additional rules. See [Core Concepts](/concepts#context-adapted-compilation) for how context resolution works.

## Token budget checking

Check compiled prompt size before sending to the model:

```ts
import { compileProfile } from "@traits-dev/core";

const compiled = compileProfile("my-agent.yaml", { model: "gpt-4o" });

if (compiled.metadata.token_count > 2000) {
  console.warn(`System prompt is ${compiled.metadata.token_count} tokens`);
}
```

Or via CLI:

```bash
traits compile my-agent.yaml --model gpt-4o --budget --budget-limit 2000
```

## LangChain / LangGraph

Place the compiled text as the system message in your chain:

```ts
import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { compileProfile } from "@traits-dev/core";

const compiled = compileProfile("profiles/resolve.yaml", { model: "gpt-4o" });
const chat = new ChatOpenAI({ modelName: "gpt-4o" });

const response = await chat.invoke([
  new SystemMessage(compiled.text),
  new HumanMessage("I need to cancel my subscription.")
]);
```

For LangGraph agents, inject the compiled text as the system message in your state graph's initial messages.
