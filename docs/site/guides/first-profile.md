# Write Your First Profile

Create a profile, validate it, compile it, and call an LLM — all in one pass.

## 1. Scaffold from a template

```bash
npx traits init my-profile.yaml --template resolve
```

This copies the `resolve` starter profile. You can also start from `haven` (healthcare), `architect` (developer), `educator`, or `advisor`.

## 2. Write your policy

Start from this v1.6 baseline and adjust only what you need:

```yaml
schema: v1.6
meta:
  name: support-lite
  version: 0.1.0
  description: Warm, direct support voice for account issues
identity:
  role: Customer support specialist
  expertise_domains:
    - billing
    - account management
voice:
  formality: medium
  warmth: high
  verbosity: medium
  directness: high
  empathy: high
  humor:
    target: very-low
    style: none
vocabulary:
  preferred_terms:
    - "I can help with this"
    - "Let me look into that"
  forbidden_terms:
    - "calm down"
    - "per our policy"
behavioral_rules:
  - Acknowledge the issue before proposing next steps
  - rule: Never claim actions without tool confirmation
    locked: true
capabilities:
  tools: []
  constraints:
    - Never claim account actions without tool confirmation.
  handoff:
    trigger: Request requires account operations outside available tools.
    action: State limitation clearly and offer human handoff.
```

**Key sections:**
- **voice** — six dimensions from `very-low` to `very-high`. See [Core Concepts](/concepts#profile-anatomy) for details.
- **behavioral_rules** — use `locked: true` (v1.6) for rules that child profiles cannot remove.
- **capabilities** — ground action claims in actual tools. Without this, S008 warns on ungrounded promises.

## 3. Validate

```bash
npx traits validate my-profile.yaml --strict
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

Exit codes: `0` clean, `1` warnings, `2` errors. See [Safety & Validation Codes](/reference/safety-codes) for every code.

## 4. Compile for your target model

```bash
npx traits compile my-profile.yaml --model gpt-4o
```

The compiler selects model-specific patterns and outputs a system prompt. Inspect the sections:

```
[VOICE TARGETS]
[BEHAVIORAL RULES]
[CAPABILITY BOUNDARIES]
[SAFETY FLOOR]
```

Compare across models:

```bash
npx traits compile my-profile.yaml --model gpt-4o
npx traits compile my-profile.yaml --model claude-sonnet-4
```

Claude prompts use `<safety_floor>` XML tags. GPT prompts use `[SAFETY FLOOR]` blocks. The compiler handles this automatically.

## 5. Call an LLM

```js
import { compileProfile } from "@traits-dev/core";
import OpenAI from "openai";

const compiled = compileProfile("my-profile.yaml", { model: "gpt-4o" });
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

The response will follow your profile's policy — high directness, high warmth, medium formality, ownership-first framing.

For more provider examples, see [Integration Recipes](/guides/integrations).

## 6. Evaluate adherence

```bash
npx traits eval my-profile.yaml --model gpt-4o \
  --response "I understand the frustration. Let me look into the double charge right now and get this resolved for you."
```

Tier 1 runs locally in milliseconds. It checks preferred term coverage, forbidden term violations, dimension alignment, and helpfulness. See [Running Evaluations](/guides/running-evaluations) for scoring semantics.

## Next steps

- [Extend Profiles Safely](/guides/extending-profiles) — compose base profiles with controlled overrides
- [Composition Patterns](/guides/composition-patterns) — three-layer fleet governance
- [CI/CD Pipeline Setup](/guides/ci-cd) — add validation and eval to your CI
- [CLI Reference](/reference/cli) — all 6 commands with flags and exit codes
