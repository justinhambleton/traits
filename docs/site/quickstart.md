# Quickstart

Get from zero to a policy-driven LLM response in 90 seconds.

## 1. Install

```bash
npm i @traits-dev/core @traits-dev/cli
```

## 2. Init a profile

```bash
npx traits init my-agent.yaml --template resolve
```

This copies the `resolve` starter profile — an ownership-first customer support policy with forbidden-term enforcement and escalation rules.

## 3. Validate

```bash
npx traits validate my-agent.yaml --strict
```

Expected output:

```
  S001  PASS  No unsafe instructions
  S002  PASS  No override attempts
  S003  PASS  No identity manipulation
  S004  PASS  Sensitive domain grounding present
  S005  PASS  No prompt injection patterns
  S006  PASS  No system prompt leakage
  S007  PASS  No harmful content
  S008  PASS  Grounding constraints present
  Schema v1.6 valid — 0 errors, 0 warnings
```

Exit codes: `0` clean, `1` warnings, `2` errors.

## 4. Compile and call an LLM

```bash
npx traits compile my-agent.yaml --model gpt-4o
```

This prints the compiled system prompt. To use it in code:

```js
import { compileProfile } from "@traits-dev/core";
import OpenAI from "openai";

const compiled = compileProfile("my-agent.yaml", { model: "gpt-4o" });
const openai = new OpenAI();

const response = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [
    { role: "system", content: compiled.text },
    { role: "user", content: "You charged me twice and nobody replied. Fix this." }
  ]
});

console.log(response.choices[0].message.content);
```

Run it:

```bash
OPENAI_API_KEY=sk-... node call.mjs
```

The response will follow the resolve profile's voice targets: high directness, high warmth, medium formality, ownership-first framing.

## 5. Evaluate adherence

```bash
npx traits eval my-agent.yaml --model gpt-4o \
  --response "I understand the frustration. Let me look into the double charge right now and get this resolved for you."
```

Tier 1 runs locally in milliseconds. It checks vocabulary coverage, forbidden-term violations, dimension alignment, and helpfulness.

## 6. Optional: Vercel AI SDK wrapper

Use `@traits-dev/vercel` if you want one-line model wrapping instead of manual `compileProfile` + `system` wiring.

```bash
npm i @traits-dev/vercel ai
```

```ts
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { withPersonality } from "@traits-dev/vercel";

const model = withPersonality(openai("gpt-4o"), "my-agent.yaml", { strict: true });
const result = await generateText({ model, prompt: "Help with my billing issue." });
console.log(result.text);
```

## 7. Optional: expose traits via MCP

Run the MCP server:

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

MCP resources and tools:

- Resources: `traits://profiles`, `traits://profiles/{name}`, `traits://profiles/{name}/compiled/{model}`
- Tools: `traits_validate`, `traits_compile`, `traits_list_profiles`

## 8. Next steps

- [Extend Profiles Safely](/guides/extending-profiles) — compose base profiles with overrides
- [Composition Patterns](/guides/composition-patterns) — three-layer fleet governance
- [Run Evaluations](/guides/running-evaluations) — tier scoring semantics and CI gating
- [Integration Recipes](/guides/integrations) — full OpenAI/Anthropic/Vercel/MCP/LangChain patterns
- [CLI Reference](/reference/cli) — all 6 commands with flags and exit codes
