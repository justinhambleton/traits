# Write Your First Profile

This is the fastest path from blank file to compiled system prompt.

## 1. Create a starter profile

```bash
pnpm exec traits init --template resolve my-profile.yaml
```

You now have a valid profile scaffold you can edit.

## 2. Author your first policy

Start from this minimal `v1.5` baseline and adjust only what you need:

```yaml
schema: "v1.5"
meta:
  name: "support-lite"
  version: "0.1.0"
  description: "Warm, direct support voice for account issues"
identity:
  role: "Customer support specialist"
voice:
  formality: "medium"
  warmth: "high"
  verbosity: "medium"
  directness: "high"
  empathy: "high"
  humor:
    target: "very-low"
    style: "none"
vocabulary:
  preferred_terms:
    - "I can help with this"
  forbidden_terms:
    - "calm down"
behavioral_rules:
  - "Acknowledge the issue before proposing next steps"
capabilities:
  tools: []
  constraints:
    - "Never claim account actions without tool confirmation."
  handoff:
    trigger: "Request requires account operations outside available tools."
    action: "State limitation clearly and offer human handoff."
```

## 3. Validate before compile

```bash
pnpm exec traits validate my-profile.yaml
pnpm exec traits validate my-profile.yaml --strict
```

Read output in this order:

1. `V*` checks: schema structure errors.
2. `S*` checks: safety and grounding warnings/errors.
3. Exit code: `0` clean, `1` warnings, `2` errors.

## 4. Compile for your target model

```bash
pnpm exec traits compile my-profile.yaml --model gpt-4o
pnpm exec traits compile my-profile.yaml --model claude-sonnet-4
```

Inspect the compiled text for:

1. `[VOICE TARGETS]`
2. `[BEHAVIORAL RULES]`
3. `[CAPABILITY BOUNDARIES]`
4. `[SAFETY FLOOR]`

## 5. Plug into your LLM stack

Use the compiled text as the system prompt input for your provider SDK.

- OpenAI/Anthropic/Vercel examples: [Integration Recipes](/guides/integrations)

## 6. Run a quick eval gate

```bash
pnpm exec traits eval my-profile.yaml --tier 1
```

Tier 1 is the default CI gate for fast policy regression checks.

Next: [Extend Profiles Safely](/guides/extending-profiles)
