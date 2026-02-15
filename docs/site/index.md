# traits.dev

Voice-profile and behavioral-policy governance for production AI systems.

## Show, Then Explain

You should not need to read a schema before seeing the value.  
Start with the [Interactive Showcase](/showcase): one prompt, three profiles, side by side.

- `haven`: healthcare-safe, high-empathy communication
- `resolve`: customer-resolution language with ownership framing
- `architect`: terse, code-first technical execution voice

## What traits.dev does

- Defines voice and behavioral policy as versioned YAML rather than ad hoc prompt strings
- Validates safety and structure before compile (`S001` to `S008`)
- Compiles model-aware prompt blocks for Claude and GPT placement
- Evaluates response adherence with reproducible tiered scoring

## Build Workflow

```bash
pnpm exec traits init --template resolve my-profile.yaml
pnpm exec traits validate my-profile.yaml --strict
pnpm exec traits compile my-profile.yaml --model gpt-4o
pnpm exec traits eval my-profile.yaml --tier 1
```

## Learn Fast

1. [Interactive Showcase](/showcase)
2. [Schema Reference (`v1.5`)](/schema-reference)
3. [Integration Recipes](/guides/integrations)
4. [Write Your First Profile](/guides/first-profile)
5. [API Reference (`@traits-dev/core`)](/api/core)
