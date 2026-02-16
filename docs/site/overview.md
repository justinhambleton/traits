# traits.dev Documentation

traits.dev is a governance SDK for AI agent behavior. Define voice and behavioral policy as structured YAML profiles. Validate safety at build time. Compile model-aware system prompts. Evaluate adherence across your agent fleet. Replace ad-hoc prompt strings with composable, testable policy.

## Get started

Install the SDK and CLI:

```bash
npm i @traits-dev/core @traits-dev/cli
```

If you are new to traits.dev, start with the [Quickstart](/quickstart) to go from zero to a policy-driven LLM response in 90 seconds. Install, scaffold a profile from a starter template, validate, compile, and call an LLM — all in one pass.

To understand the conceptual model behind profiles, validation, compilation, and evaluation, read [Core Concepts](/concepts). It covers the governance pipeline, model-aware compilation, composition as fleet governance, the safety model, and the three evaluation tiers.

## Quick references

### Define profiles

- **[Write Your First Profile](/guides/first-profile)** — Scaffold, validate, compile, and call an LLM end-to-end
- **[Schema Reference](/schema-reference)** — Full v1.6 schema with all sections, fields, and types
- **[Extend Profiles Safely](/guides/extending-profiles)** — Compose base profiles with controlled inheritance
- **[Composition Patterns](/guides/composition-patterns)** — Three-layer fleet governance architecture

### Validate and compile

- **[CLI Reference](/reference/cli)** — All six commands with flags, options, and exit codes
- **[Safety & Validation Codes](/reference/safety-codes)** — Every code reported by `traits validate`
- **[Integration Recipes](/guides/integrations)** — OpenAI, Anthropic, Vercel AI SDK, and LangChain patterns

### Evaluate

- **[Running Evaluations](/guides/running-evaluations)** — Tier scoring semantics, sample files, and CI gating
- **[Eval Scoring Reference](/reference/eval-scoring)** — Scoring algorithms, weights, and dimension alignment formulas
- **[CI/CD Pipeline Setup](/guides/ci-cd)** — GitHub Actions, JUnit output, and release gates

### Reference

- **[API (`@traits-dev/core`)](/api/core)** — Public TypeScript API surface with all function signatures
- **[Playground](/playground/)** — Interactive voice dimension playground with compiled prompt preview
- **[Showcase](/showcase/)** — Side-by-side profile comparison with precomputed responses
