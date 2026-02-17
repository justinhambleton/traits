# traits.dev

[![npm @traits-dev/core](https://img.shields.io/npm/v/@traits-dev/core?label=%40traits-dev%2Fcore)](https://www.npmjs.com/package/@traits-dev/core)
[![npm @traits-dev/cli](https://img.shields.io/npm/v/@traits-dev/cli?label=%40traits-dev%2Fcli)](https://www.npmjs.com/package/@traits-dev/cli)
[![npm @traits-dev/vercel](https://img.shields.io/npm/v/@traits-dev/vercel?label=%40traits-dev%2Fvercel)](https://www.npmjs.com/package/@traits-dev/vercel)
[![npm @traits-dev/mcp](https://img.shields.io/npm/v/@traits-dev/mcp?label=%40traits-dev%2Fmcp)](https://www.npmjs.com/package/@traits-dev/mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/justinhambleton/traits/actions/workflows/release.yml/badge.svg)](https://github.com/justinhambleton/traits/actions/workflows/release.yml)

Voice profile and behavioral policy infrastructure for production AI systems.

`traits.dev` helps teams define how assistants should communicate, validate policy safety before shipping, compile model-aware system prompt blocks, and evaluate adherence over time.

## What traits.dev gives you

- Versioned YAML profiles instead of ad hoc prompt text
- Schema validation with safety checks (`S001` to `S008`)
- Deterministic profile composition (`extends`) for reusable policy layers
- Model-aware compilation for Claude and GPT prompt placement
- Multi-tier evaluation tooling for local and CI workflows

This repository is a monorepo containing core tooling and integration packages.

## Packages

- `@traits-dev/core`
  - Runtime SDK for load/resolve/validate/compile/inject/eval/import flows
  - Public API plus internal monorepo entrypoint (`@traits-dev/core/internal`)
- `@traits-dev/cli`
  - Commands: `init`, `validate`, `compile`, `eval`, `import`
- `@traits-dev/vercel`
  - Vercel AI SDK middleware via `withPersonality()`
  - One-line model wrapping with eager compile and automatic system injection
- `@traits-dev/mcp`
  - MCP server exposing traits tools/resources for Claude Desktop, Cursor, and other MCP clients
  - Run with `npx @traits-dev/mcp` or `traits-mcp`

## Install

### SDK

```bash
pnpm add @traits-dev/core
```

### Vercel AI SDK integration

```bash
pnpm add @traits-dev/vercel ai
```

### CLI

```bash
pnpm add -D @traits-dev/cli
```

### MCP server

Run without install:

```bash
npx -y @traits-dev/mcp
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

## Quick start (Vercel AI SDK)

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
  prompt: "I was charged twice. Please fix this."
});

console.log(result.text);
```

## Quick start (MCP)

`@traits-dev/mcp` exposes starter profiles as MCP resources and traits operations as tools.

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
- `educator`
- `advisor`

## Repo layout

```text
packages/core/      SDK runtime + validators + compiler + evaluators
packages/cli/       CLI command surface
packages/vercel/    Vercel AI SDK middleware adapter
packages/mcp/       MCP server package
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

Publishing uses token-based auth via Changesets GitHub Action.

## Documentation

- Schema reference: `docs/site/schema-reference.md`
- Guides: `docs/site/guides/`
- API references:
  - `docs/site/api/core.md`
  - `docs/site/api/vercel.md`
  - `docs/site/api/mcp.md`
- Contributing guide: `CONTRIBUTING.md`
- Security policy: `SECURITY.md`

## License

MIT, see `LICENSE`.
