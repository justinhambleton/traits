# Development Directive: Knowledge-Base Calibration Remediation (#4)

## Context

Structural remediation is complete. The remaining high-severity item is knowledge-base quality:

- `knowledge-base/claude/patterns.json`: dimensions `0/30` calibrated, interactions `0/3` calibrated
- `knowledge-base/gpt/patterns.json`: dimensions `0/30` calibrated, interactions `0/3` calibrated
- Pattern text is still placeholder-style scaffolding, which weakens the compiler's model-specific value.

## Objective

Replace placeholder pattern content with model-meaningful patterns and complete an evidence-backed calibration pass so both model files are fully calibrated and measurable.

## Execution Order

All steps should be completed in order.

### Step 1: Add Calibration Status and Contracts (do first)

- Add `experiment/scripts/report-calibration-status.mjs`.
- Script requirements:
  - Read `knowledge-base/{claude,gpt}/patterns.json`.
  - Report calibrated counts for dimensions and interactions.
  - Report placeholder-pattern detection count (e.g., patterns starting with `Claude pattern:` or `GPT pattern:`).
  - Exit non-zero with `--strict` if any entry is uncalibrated or placeholder.
- Add machine-readable calibration run contract:
  - `experiment/calibration/README.md` with input/output JSON schemas.
  - `experiment/calibration/scenarios.v1.json` with 20 canonical scenarios (mix of neutral, frustrated, safety-sensitive, formal, casual).

Acceptance criteria:
- `node experiment/scripts/report-calibration-status.mjs` prints per-model summary.
- `node experiment/scripts/report-calibration-status.mjs --strict` fails on current baseline.

### Step 2: Replace Placeholder Pattern Text (authoring pass)

- Update both files:
  - `knowledge-base/claude/patterns.json`
  - `knowledge-base/gpt/patterns.json`
- Replace all 60 dimension pattern strings with non-template, dimension-level guidance.
- Keep interaction patterns but refine text where needed for model-specific style.
- Keep `calibrated: false` and current adherence values until measured.

Acceptance criteria:
- No dimension pattern contains placeholder prefix text.
- `report-calibration-status` shows placeholder count `0` for both models.

### Step 3: Build Calibration Harness (measurement)

- Add `experiment/scripts/calibrate-patterns.mjs`.
- Harness requirements:
  - Inputs: `--model`, `--scenarios`, `--out`, optional provider/model override flags.
  - Evaluate each dimension-level pattern and each interaction pattern against the scenario set.
  - Produce two artifacts per run:
    - `raw-results.json` (per-scenario scores)
    - `updates.json` compatible with `mergeCalibrationFile()`.
  - Use existing eval scoring where possible; avoid changing compiler behavior in this step.

Acceptance criteria:
- Harness runs for `claude` and `gpt` and emits both artifacts.
- `updates.json` can be consumed directly by `experiment/scripts/calibrate-from-json.mjs`.

### Step 4: Apply Calibrations to Knowledge Base

- Apply run outputs with existing merge script:
  - `node experiment/scripts/calibrate-from-json.mjs --model claude --input <updates.json>`
  - `node experiment/scripts/calibrate-from-json.mjs --model gpt --input <updates.json>`
- Ensure each updated entry includes:
  - measured `adherence`
  - `calibrated: true`
- Update `knowledge-base/manifest.json` version and timestamp.

Acceptance criteria:
- `claude` dimensions: `30/30` calibrated, interactions: `3/3` calibrated.
- `gpt` dimensions: `30/30` calibrated, interactions: `3/3` calibrated.

### Step 5: Record Evidence and Add Guardrails

- Add `knowledge-base/calibration-notes.md` with:
  - run date and model versions
  - summary table of per-dimension adherence (mean/min/max)
  - interaction results
  - patterns below threshold and rationale for acceptance/defer
- Add a CI/local guard script:
  - `pnpm run calibration:check` -> strict status check.
  - Fail if any pattern is uncalibrated or placeholder.

Suggested initial thresholds:
- Base dimensions: `>= 0.75`
- Humor dimension entries: `>= 0.65`
- Interaction patterns: `>= 0.70`

Acceptance criteria:
- `pnpm test` remains green.
- `pnpm run calibration:check` passes.

## What Not To Do During This Remediation

- Do not refactor knowledge-base storage layout (keep current `patterns.json` shape).
- Do not change compile-time selection semantics in `packages/core/src/compiler/patterns.ts`.
- Do not add new CLI commands for this pass.
- Do not mix unrelated feature work into the calibration branch.

## Definition of Done

1. All knowledge-base patterns are non-placeholder and calibrated (`true`).
2. Adherence scores are measured and written from harness output.
3. Calibration evidence is documented in `knowledge-base/calibration-notes.md`.
4. A strict calibration check exists and passes.
5. Existing build/typecheck/test gates remain green.
