# CI/CD Pipeline Setup

Add policy validation and evaluation to your CI pipeline. This guide covers GitHub Actions; adapt the patterns for other CI systems.

## Validation gate

Validate every profile on every pull request. This catches schema errors and safety violations before merge.

```yaml
name: Validate profiles
on: [pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - name: Validate all profiles
        run: |
          for profile in profiles/*.yaml; do
            npx traits validate "$profile" --strict
          done
```

For SARIF output (GitHub Code Scanning integration):

```yaml
      - name: Validate with SARIF
        run: npx traits validate profiles/resolve.yaml --format sarif > validate.sarif
      - uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: validate.sarif
```

## Token budget check

Catch prompt growth before it affects production latency or exceeds model context windows.

```yaml
      - name: Check token budgets
        run: |
          for profile in profiles/*.yaml; do
            npx traits compile "$profile" --model gpt-4o --budget --budget-limit 2000
          done
```

The `--budget-limit` flag writes a warning to stderr if the estimated token count exceeds the limit. Combine with `set -e` to fail the job on budget violations.

## Tier 1 evaluation gate

Tier 1 runs locally in milliseconds with no API keys. Use it as a merge gate.

```yaml
name: Eval policy adherence
on: [pull_request]

jobs:
  eval:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - name: Run Tier 1 eval
        run: |
          npx traits eval profiles/resolve.yaml --model gpt-4o \
            --suite support --format junit \
            --junit-threshold 0.8 > eval-results.xml
      - uses: mikepenz/action-junit-report@v4
        if: always()
        with:
          report_paths: eval-results.xml
```

### JUnit thresholds

Set per-tier thresholds to control pass/fail:

```bash
# Global threshold (all tiers)
traits eval my-agent.yaml --model gpt-4o --format junit --junit-threshold 0.8

# Per-tier thresholds
traits eval my-agent.yaml --model gpt-4o --format junit \
  --junit-threshold-tier1 0.85 \
  --junit-threshold-tier2 0.7 \
  --junit-threshold-tier3 0.6
```

Default threshold: 0.7. Exit code 1 when any sample falls below.

## Tier 2/3 on release candidates

Run higher tiers on scheduled jobs or release branches. These require API keys.

```yaml
name: Full eval suite
on:
  schedule:
    - cron: "0 6 * * 1"  # Weekly Monday 6am
  workflow_dispatch:

jobs:
  full-eval:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - name: Run all tiers
        env:
          TRAITS_OPENAI_API_KEY: ${{ secrets.TRAITS_OPENAI_API_KEY }}
        run: |
          npx traits eval profiles/resolve.yaml --model gpt-4o \
            --suite support --tier 3 --format json > eval-full.json
      - uses: actions/upload-artifact@v4
        with:
          name: eval-results
          path: eval-full.json
```

## Multi-profile fleet validation

Validate and evaluate all profiles in a directory:

```yaml
      - name: Validate fleet
        run: |
          set -e
          for profile in profiles/*.yaml; do
            echo "--- Validating $profile ---"
            npx traits validate "$profile" --strict
            echo "--- Compiling $profile ---"
            npx traits compile "$profile" --model gpt-4o --budget --budget-limit 2000
          done
      - name: Eval fleet (Tier 1)
        run: |
          for profile in profiles/*.yaml; do
            echo "--- Evaluating $profile ---"
            npx traits eval "$profile" --model gpt-4o --tier 1 \
              --format junit --junit-threshold 0.8 > "eval-$(basename $profile .yaml).xml"
          done
      - uses: mikepenz/action-junit-report@v4
        if: always()
        with:
          report_paths: eval-*.xml
```

## Documentation gate before publish

Package releases should block on docs updates for any user-facing API/CLI/integration changes.

Recommended pre-publish checks:

```bash
pnpm build
pnpm typecheck
pnpm test
pnpm docs:build
```

Repository workflow:

- Use `docs/documentation-release-checklist.md` as the release documentation sign-off
- Ensure package README updates and docs site updates are in the same PR as behavior changes
- Keep release automation gated by `Docs Build` before publish

## Decision tree

```
Every pull request:
  ├─ traits validate --strict         (catch schema/safety errors)
  ├─ traits compile --budget-limit    (catch prompt growth)
  └─ traits eval --tier 1 --format junit  (catch policy regression)

Release candidate:
  ├─ All PR checks
  └─ traits eval --tier 3 --format json  (high-fidelity adherence)

Scheduled (weekly):
  └─ Full fleet eval --tier 3         (drift monitoring)
```

## Environment variables

| Variable | Required for | Where to set |
|----------|-------------|--------------|
| `TRAITS_OPENAI_API_KEY` | Tier 2 embeddings, Tier 3 OpenAI judge | Repository secrets |
| `TRAITS_ANTHROPIC_API_KEY` | Tier 3 Anthropic judge | Repository secrets |

Missing credentials downgrade execution to available tiers instead of failing. Tier 1 never requires credentials.

## Exit codes

| Command | 0 | 1 | 2 |
|---------|---|---|---|
| `validate` | Clean | Warnings only | Errors |
| `compile` | Success | — | Validation/compile error |
| `eval` | Success | JUnit threshold failure | Validation/provider error |

See the full [CLI Reference](/reference/cli) for all commands and flags.
