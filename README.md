# traits.dev

Voice profile and behavioral policy infrastructure for production AI systems.

`traits.dev` helps teams define how assistants should communicate, validate policy safety before shipping, compile model-aware system prompt blocks, and evaluate adherence over time.

## What traits.dev gives you

- Versioned YAML profiles instead of ad hoc prompt text
- Schema validation with safety checks (`S001` to `S008`)
- Deterministic profile composition (`extends`) for reusable policy layers
- Model-aware compilation for Claude and GPT prompt placement
- Multi-tier evaluation tooling for local and CI workflows

This repository is a monorepo containing both the SDK and CLI.

## Packages

- `@traits-dev/core`
  - Runtime SDK for load/resolve/validate/compile/inject/eval/import flows
  - Public API plus internal monorepo entrypoint (`@traits-dev/core/internal`)
- `@traits-dev/cli`
  - Commands: `init`, `validate`, `compile`, `eval`, `import`

## Install

### SDK

```bash
pnpm add @traits-dev/core
```

### CLI

```bash
pnpm add -D @traits-dev/cli
```

Or run directly without install:

```bash
npx @traits-dev/cli validate profiles/resolve.yaml
```

## Quick start (CLI)

```bash
# 1) Create a starter profile
pnpm exec traits init my-profile.yaml --template resolve

# 2) Validate with strict safety gating
pnpm exec traits validate my-profile.yaml --strict

# 3) Compile for your target model
pnpm exec traits compile my-profile.yaml --model gpt-4o

# 4) Optional: prompt budget awareness
pnpm exec traits compile my-profile.yaml --model gpt-4o --budget --budget-limit 2000

# 5) Evaluate against built-in suites or custom samples
pnpm exec traits eval my-profile.yaml --model gpt-4o --suite support --tier 1
pnpm exec traits eval my-profile.yaml --model gpt-4o --format json
pnpm exec traits eval my-profile.yaml --model gpt-4o --format junit --junit-threshold 0.7
```

## Quick start (SDK)

```ts
import { compileProfile, injectPersonality, validateProfile } from "@traits-dev/core";

const validation = validateProfile("profiles/resolve.yaml", { strict: true });
if (!validation.isValid) {
  throw new Error("Profile is not valid for production use.");
}

const compiled = compileProfile("profiles/resolve.yaml", {
  model: "gpt-4o",
  explain: true
});

const finalSystem = injectPersonality({
  compiledPersonality: compiled,
  model: "gpt-4o",
  system: "You are a helpful assistant."
});
```

## Schema versions

Supported profile schemas:

- `v1.4` baseline voice-policy schema
- `v1.5` adds `capabilities` boundaries
- `v1.6` adds:
  - Array `extends` (`string | string[]`) with left-to-right merge
  - Locked rule constraints via `{ rule, locked?: boolean }`

### `v1.6` composition example

```yaml
schema: "v1.6"
extends:
  - "brand-base"
  - "domain-support"
  - "channel-chat"

behavioral_rules:
  - "Lead with implementation, not theory"
  - rule: "Never claim actions without tool confirmation"
    locked: true

capabilities:
  tools: []
  constraints:
    - rule: "Never claim completed side effects without tool evidence."
      locked: true
  handoff:
    trigger: "Request requires unavailable operations"
    action: "Offer human handoff"
```

## Safety model

Validation includes:

- Structural checks (`V001`-`V003`)
- Safety checks (`S001`-`S008`)
- Overspec thresholding (`S004`)
- Inheritance safety regression protection (`S006`)

Important inheritance behavior in `v1.6`:

- Array `extends` merges parent profiles left to right, then child on top
- Locked inherited behavioral rules cannot be removed by `behavioral_rules_remove`
- Attempted locked removal emits `S006` error

## Evaluation model

- Tier 1: deterministic vocabulary/structure/helpfulness scoring
- Tier 2: embedding-based adherence scoring
- Tier 3: LLM-judge dimension adherence scoring

CLI output formats:

- Human-readable text (default)
- JSON (`--format json`)
- JUnit (`--format junit`) for CI dashboards/gates

Built-in suites:

- `support`
- `healthcare`
- `developer`

## Repo layout

```text
packages/core/      SDK runtime + validators + compiler + evaluators
packages/cli/       CLI command surface
profiles/           Canonical profile artifacts + test fixtures
knowledge-base/     Pattern libraries + calibration metadata
experiment/         Calibration and evaluation scripts/artifacts
docs/site/          VitePress documentation content
```

## Develop in this monorepo

```bash
pnpm install
pnpm build
pnpm typecheck
pnpm test
```

Useful scripts:

- `pnpm docs:dev` run docs locally
- `pnpm showcase:build` rebuild static showcase data
- `pnpm calibration:check` strict calibration status check

## Release flow

This repo uses Changesets + GitHub Actions release automation.

```bash
pnpm changeset
pnpm version-packages
git push origin main
```

Trusted publishing is configured via npm OIDC in CI.

## Documentation

- Schema reference: `docs/site/schema-reference.md`
- Guides: `docs/site/guides/`
- API reference: `docs/site/api/core.md`
- Contributing guide: `CONTRIBUTING.md`
- Security policy: `SECURITY.md`

## License

MIT, see `LICENSE`.
