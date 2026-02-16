# CLI Reference

All commands are available via `npx traits <command>` or `pnpm exec traits <command>`.

## init

Scaffold a new profile from scratch or from a starter template.

```bash
traits init [output-path] [options]
```

| Option | Description |
|--------|-------------|
| `--name <name>` | Profile name |
| `--domain <domain>` | Domain or vertical |
| `--model <model>` | Primary model target metadata (tag only) |
| `--tone <tone>` | Tone preset: `balanced`, `warm`, `direct`, `formal` |
| `--template <profile>` | Start from a starter profile (e.g., `resolve`, `haven`, `architect`) |
| `--force` | Overwrite output file if it exists |
| `--verbose` | Include additional command metadata |
| `--no-color` | Disable colorized output |

When run interactively without flags, prompts for name, domain, model, and tone. In non-TTY mode, uses defaults.

```bash
# From template
traits init my-agent.yaml --template resolve

# Interactive scaffold
traits init my-agent.yaml

# Non-interactive with presets
traits init support-bot.yaml --name support-bot --domain customer-support --tone warm
```

**Exit codes:** `0` success, `1` argument error, `2` generated profile failed validation.

---

## validate

Run schema and safety checks against a profile.

```bash
traits validate <profile-path> [options]
```

| Option | Description |
|--------|-------------|
| `--strict` | Promote warnings to errors |
| `--format <text\|json\|sarif>` | Output format (default: `text`) |
| `--json` | Shorthand for `--format json` |
| `--bundled-profiles-dir <dir>` | Directory for bundled starter profiles |
| `--verbose` | Include additional command metadata |
| `--no-color` | Disable colorized output |

Checks:

- `V001`–`V003`: Schema structure errors
- `S001`–`S008`: Safety and grounding checks

```bash
# Standard validation
traits validate my-agent.yaml

# Strict mode — warnings become errors
traits validate my-agent.yaml --strict

# SARIF output for CI integration
traits validate my-agent.yaml --format sarif > report.sarif
```

**Exit codes:** `0` clean, `1` warnings only, `2` errors.

---

## compile

Compile a validated profile into a model-specific system prompt.

```bash
traits compile <profile-path> --model <model> [options]
```

| Option | Description |
|--------|-------------|
| `--model <model>` | Model target (required) |
| `--strict` | Treat warnings as compile-blocking |
| `--json` | Output structured JSON |
| `--budget` | Print estimated token count (chars/4) |
| `--budget-limit <tokens>` | Warn to stderr if estimate exceeds limit |
| `--explain` | Include compilation trace output |
| `--context key=value` | Activate context adaptation (repeatable) |
| `--knowledge-base-dir <dir>` | Directory containing compiler pattern files |
| `--bundled-profiles-dir <dir>` | Directory for bundled starter profiles |
| `--verbose` | Include additional command metadata |
| `--no-color` | Disable colorized output |

```bash
# Compile for GPT-4o
traits compile my-agent.yaml --model gpt-4o

# Compile for Claude with token budget check
traits compile my-agent.yaml --model claude-sonnet-4 --budget --budget-limit 2000

# Compile with context adaptation
traits compile my-agent.yaml --model gpt-4o --context frustrated_user=true

# JSON output with trace
traits compile my-agent.yaml --model gpt-4o --json --explain
```

**Exit codes:** `0` success, `2` validation failure or compile error.

---

## eval

Score agent responses against profile policy across three evaluation tiers.

```bash
traits eval <profile-path> --model <model> [options]
```

| Option | Description |
|--------|-------------|
| `--model <model>` | Model target (required) |
| `--tier <1\|2\|3>` | Highest tier to run (default: highest available) |
| `--suite <name>` | Built-in baseline suite: `support`, `healthcare`, `developer`, `educator`, `advisor` |
| `--response <text>` | Assistant response sample (repeatable) |
| `--samples <path>` | JSON file with samples: `[{ id, response }]` |
| `--provider <name>` | Judge provider for Tier 3: `auto`, `openai`, `anthropic` |
| `--embedding-model <name>` | Embedding model for Tier 2 |
| `--judge-model <name>` | Judge model for Tier 3 |
| `--format <text\|json\|junit>` | Output format (default: `text`) |
| `--json` | Shorthand for `--format json` |
| `--junit-threshold <num>` | Global JUnit pass threshold in [0,1] (default: 0.7) |
| `--junit-threshold-tier1 <num>` | Tier 1 JUnit threshold override |
| `--junit-threshold-tier2 <num>` | Tier 2 JUnit threshold override |
| `--junit-threshold-tier3 <num>` | Tier 3 JUnit threshold override |
| `--no-baselines` | Skip offline baseline scaffold comparison |
| `--no-helpfulness` | Skip helpfulness checks in scoring |
| `--strict` | Treat validation warnings as errors |
| `--verbose` | Include command metadata output |
| `--no-color` | Disable colorized output |

Provider options (Tier 2/3):

| Option | Description |
|--------|-------------|
| `--openai-base-url <url>` | Override OpenAI API base URL |
| `--anthropic-base-url <url>` | Override Anthropic API base URL |
| `--timeout-ms <ms>` | Provider request timeout (default: 20000) |
| `--max-retries <count>` | Provider retry attempts (default: 2) |
| `--retry-base-ms <ms>` | Base backoff delay (default: 250) |

```bash
# Tier 1 only — local, no API keys needed
traits eval my-agent.yaml --model gpt-4o \
  --response "I understand. Let me resolve this now."

# From a samples file
traits eval my-agent.yaml --model gpt-4o --samples eval-samples.json

# Built-in suite with JUnit output for CI
traits eval my-agent.yaml --model gpt-4o --suite support --format junit

# All tiers with JSON output
TRAITS_OPENAI_API_KEY=sk-... \
  traits eval my-agent.yaml --model gpt-4o --tier 3 --json
```

**Environment variables:**

| Variable | Used by |
|----------|---------|
| `TRAITS_OPENAI_API_KEY` | Tier 2 embeddings, Tier 3 OpenAI judge |
| `TRAITS_ANTHROPIC_API_KEY` | Tier 3 Anthropic judge |

Missing credentials downgrade execution to available tiers instead of failing.

**Exit codes:** `0` success, `1` JUnit threshold failure or argument error, `2` validation or provider error.

---

## import

Convert an existing system prompt into a structured traits profile using LLM analysis.

```bash
traits import [prompt-path] [options]
```

| Option | Description |
|--------|-------------|
| `--provider <name>` | Import provider: `auto`, `openai`, `anthropic` (default: `auto`) |
| `--model <model>` | Import analysis model override |
| `--name <profile-name>` | Output profile `meta.name` override |
| `--output <path>` | Write generated YAML profile to file |
| `--openai-base-url <url>` | Override OpenAI API base URL |
| `--anthropic-base-url <url>` | Override Anthropic API base URL |
| `--timeout-ms <ms>` | Provider request timeout (default: 20000) |
| `--max-retries <count>` | Provider retry attempts (default: 2) |
| `--retry-base-ms <ms>` | Base backoff delay (default: 250) |
| `--strict` | Treat validation warnings as errors |
| `--json` | Output structured JSON |
| `--verbose` | Include command metadata output |
| `--no-color` | Disable colorized output |

Input via file path or stdin:

```bash
# From file
traits import prompts/old-system-prompt.txt --output my-agent.yaml

# From stdin
cat prompts/old-system-prompt.txt | traits import --output my-agent.yaml
```

**Environment variables:** `TRAITS_OPENAI_API_KEY`, `TRAITS_ANTHROPIC_API_KEY`

**Exit codes:** `0` success, `1` argument error, `2` provider or validation error.

---

## migrate

Upgrade a profile from an older schema version to a newer one.

```bash
traits migrate <profile-path> [options]
```

| Option | Description |
|--------|-------------|
| `--to <version>` | Target schema version (default: `v1.6`; supported: `v1.5`, `v1.6`) |
| `--output <path>` | Output file path (default: `<name>.<target>.yaml`) |
| `--in-place` | Overwrite the source file (requires `--force`) |
| `--force` | Overwrite existing destination file |
| `--normalize-extends` | Convert single-string extends to array form (v1.6 only) |
| `--json` | Output structured JSON summary |
| `--verbose` | Include additional command metadata |
| `--no-color` | Disable colorized output |

Supported migration paths: `v1.4 -> v1.5`, `v1.4 -> v1.6`, `v1.5 -> v1.6`. Downgrades are not supported.

```bash
# Migrate v1.4 to v1.6
traits migrate old-profile.yaml --to v1.6

# Migrate in-place
traits migrate my-profile.yaml --in-place --force

# Migrate with extends normalization
traits migrate my-profile.yaml --to v1.6 --normalize-extends
```

**Exit codes:** `0` success, `1` argument or source error, `2` migrated profile failed validation.
