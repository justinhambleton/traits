Voice-profile and behavioral-policy governance for production AI systems.

## What traits.dev does

- Defines voice and behavioral policy as versioned YAML rather than ad hoc prompt strings
- Validates safety and structure before compile (`S001` to `S008`)
- Compiles model-aware prompt blocks for Claude and GPT placement
- Evaluates response adherence with reproducible tiered scoring

## Quick Install

```bash
pnpm add @traits-dev/core
pnpm add -D @traits-dev/cli
```

## Quick Start

```bash
pnpm exec traits init --template resolve my-profile.yaml
pnpm exec traits validate my-profile.yaml --strict
pnpm exec traits compile my-profile.yaml --model gpt-4o
pnpm exec traits eval my-profile.yaml --tier 1
```
