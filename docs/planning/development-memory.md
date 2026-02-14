# Development Memory

Decision log for implementation-critical choices. Keep entries brief and factual.

## Template

- Date:
- Decision:
- Why:
- Files:
- Follow-up:

## Entries

- Date: 2026-02-13
- Decision: Configure `context7` MCP in Codex config and standardize project working agreement in `codex.md`.
- Why: Ensure external technical references are accessible through MCP and make execution practices explicit for consistent implementation quality.
- Files: `~/.codex/config.toml`, `codex.md`
- Follow-up: Start coding with `extends` resolution + S006/S007 validator path and fixture-backed tests.

- Date: 2026-02-13
- Decision: Implement initial `@traits-dev/core` runtime for YAML profile loading, `extends` merge semantics, explicit `_remove` handling, `S006` diagnostics, `S007` diagnostics, and context conflict resolution utility; validate against starter fixtures.
- Why: Unblock compiler/validator development by locking the profile normalization and safety-regression baseline behavior first.
- Files: `package.json`, `pnpm-workspace.yaml`, `packages/core/package.json`, `packages/core/src/index.js`, `packages/core/src/profile.js`, `packages/core/test/extends.test.js`
- Follow-up: Add strict validation modes and implement full validator pipeline around this normalization layer (S001-S005, S002 per-adaptation envelopes, strict warning gating).

- Date: 2026-02-14
- Decision: Add validator pipeline over resolved profiles with S001-S005 checks, S002 per-context envelope re-evaluation, S004 constraint thresholds, and strict warning promotion (`--strict` contract behavior).
- Why: Move from merge-only normalization to enforceable safety and CI gating semantics while preserving existing S006/S007 diagnostics from extends resolution.
- Files: `packages/core/src/index.js`, `packages/core/src/validator/extremes.js`, `packages/core/src/validator/overspec.js`, `packages/core/src/validator/safety.js`, `packages/core/src/validator/engine.js`, `packages/core/test/validator.test.js`
- Follow-up: Implement schema/structure validation (required sections + level enums + adaptation range integrity) and wire validator output to upcoming CLI `traits validate` surface.

- Date: 2026-02-14
- Decision: Add schema validator checks (V001-V003) and CLI-oriented validation formatting utilities, then wire both into the core validation engine.
- Why: Complete the next MVP validator layer by enforcing required structure/enum/range contracts and establishing reusable text/JSON output interfaces for the upcoming `traits validate` command.
- Files: `packages/core/src/validator/schema.js`, `packages/core/src/validator/engine.js`, `packages/core/src/validator/format.js`, `packages/core/src/index.js`, `packages/core/test/schema-format.test.js`, `packages/core/test/validator.test.js`
- Follow-up: Build CLI scaffolding in `packages/cli` and connect `traits validate` flags (`--json`, `--strict`) to these core validator APIs.

- Date: 2026-02-14
- Decision: Create `@traits-dev/cli` package with `traits validate` command, wired to core validation APIs and supporting `--json` and `--strict` behavior with tested exit codes (0/1/2).
- Why: Deliver the first end-user CLI loop for profile validation and align command behavior with the validator/compiler gating contract in the implementation plan.
- Files: `package.json`, `packages/cli/package.json`, `packages/cli/src/bin/traits.js`, `packages/cli/src/commands/validate.js`, `packages/cli/test/validate.test.js`, `packages/core/src/validator/format.js`
- Follow-up: Implement `traits init` command to generate valid v1.4 scaffolds and add CLI integration tests for init→validate flow.

- Date: 2026-02-14
- Decision: Implement `traits init` scaffold generation (including `--template` and overwrite protection), add global CLI flag handling (`--json`, `--verbose`, `--no-color`, `--version`), and expand CLI integration coverage.
- Why: Complete the Week 6 CLI scaffolding path so users can create and validate profiles with a single command-line loop using documented flags and predictable behavior.
- Files: `packages/cli/src/commands/init.js`, `packages/cli/src/bin/traits.js`, `packages/cli/src/commands/validate.js`, `packages/cli/test/init.test.js`, `packages/cli/test/validate.test.js`
- Follow-up: Add `traits validate` coverage for explicit unsafe/overspecified fixture files and start `traits compile` CLI skeleton wired to core compile API once compiler surface exists.

- Date: 2026-02-14
- Decision: Add explicit unsafe and overspecified fixture profiles and verify `traits validate` exit-code behavior in CLI integration tests (unsafe=2, overspec warning=1).
- Why: Align CLI regression coverage with MVP plan acceptance criteria for intentionally unsafe and overspecified profiles.
- Files: `profiles/test-fixtures/_unsafe-s001-test.yaml`, `profiles/test-fixtures/_overspec-s004-warning-test.yaml`, `packages/cli/test/validate.test.js`
- Follow-up: Begin compiler package surface (`compile` API + placeholder pattern assembly) so `traits compile` command can be scaffolded next.

- Date: 2026-02-14
- Decision: Add baseline compiler surface in core (`compileProfile`) and wire `traits compile` CLI with validation gating, model placement metadata, context adaptation application, trace output, and safety-floor inclusion.
- Why: Unblock compile-stage workflow and integration testing while preserving the MVP contract that compiler owns safety-floor injection and compile is blocked only by validation errors (or warnings under `--strict`).
- Files: `packages/core/src/compiler/engine.js`, `packages/core/src/compiler/safety-floor.js`, `packages/core/src/index.js`, `packages/core/test/compile.test.js`, `packages/cli/src/commands/compile.js`, `packages/cli/src/bin/traits.js`, `packages/cli/test/compile.test.js`
- Follow-up: Implement `injectPersonality` helper with section-detection heuristics and add compile→inject integration tests for Claude/GPT placement behavior.

- Date: 2026-02-14
- Decision: Implement `injectPersonality` with tools-section detection heuristics and placement behavior for Claude/GPT models without re-appending safety-floor content.
- Why: Complete Week 10’s core integration path so compiled personality blocks can be inserted deterministically into existing system prompts while preserving single-owner safety-floor semantics.
- Files: `packages/core/src/inject/detect-sections.js`, `packages/core/src/inject/inject.js`, `packages/core/src/index.js`, `packages/core/test/inject.test.js`
- Follow-up: Expose `injectPersonality` in CLI examples/docs and consider adding a dedicated `traits inject` command if direct manipulation workflows become common.

- Date: 2026-02-14
- Decision: Add compiler pattern-selection and interaction-pattern modules, and include pattern decisions in compile trace output (`--explain` path).
- Why: Move compile output closer to planned calibration architecture by making per-dimension and interaction guidance explicit and testable, rather than implicit text assembly only.
- Files: `packages/core/src/compiler/patterns.js`, `packages/core/src/compiler/engine.js`, `packages/core/test/compile.test.js`
- Follow-up: Introduce external knowledge-base file loading for pattern definitions and model calibration metadata.

- Date: 2026-02-14
- Decision: Introduce file-backed knowledge-base patterns (manifest + model pattern JSON), wire compiler pattern selection to read these files, and expose source provenance in compile traces.
- Why: Establish the planned knowledge-base architecture so compile behavior can be calibrated by data updates rather than code edits.
- Files: `knowledge-base/manifest.json`, `knowledge-base/claude/patterns.json`, `knowledge-base/gpt/patterns.json`, `packages/core/src/compiler/patterns.js`, `packages/core/src/compiler/engine.js`, `packages/core/test/compile.test.js`, `packages/cli/src/commands/compile.js`, `packages/cli/test/compile.test.js`
- Follow-up: Add calibration tooling to update adherence scores and versions in knowledge-base files from eval outputs.

- Date: 2026-02-14
- Decision: Add calibration update plumbing (core merge helpers + script) and end-to-end workflow regression coverage (`init -> validate -> compile`).
- Why: Provide a practical mechanism for applying calibration outputs to the knowledge-base and lock the primary CLI workflow into automated tests.
- Files: `packages/core/src/compiler/calibration.js`, `packages/core/src/index.js`, `packages/core/test/calibration.test.js`, `experiment/scripts/calibrate-from-json.mjs`, `packages/cli/test/workflow.test.js`
- Follow-up: Define an eval output contract and wire calibration script directly to eval artifacts once `traits eval` scaffolding lands.

- Date: 2026-02-14
- Decision: Add eval scaffolding in core for scenario contract validation and deterministic Tier 1 response scoring utilities.
- Why: Establish the first local eval layer (no API keys) so profile behavior can be scored and regression-tested before Tier 2/Tier 3 external-model evaluation is implemented.
- Files: `packages/core/src/eval/types.js`, `packages/core/src/eval/tier1.js`, `packages/core/src/index.js`, `packages/core/test/eval-tier1.test.js`
- Follow-up: Scaffold `traits eval` CLI with Tier 1 execution and JSON reporting, then add API-key-gated Tier 2/Tier 3 stubs.

- Date: 2026-02-14
- Decision: Implement `traits eval` CLI scaffold (Tier 1 execution path) with sample input support, JSON/text output, tier fallback messaging, and validation-gated error handling.
- Why: Enable an end-user eval loop for local deterministic checks now, while reserving Tier 2/Tier 3 for future API-backed implementation.
- Files: `packages/cli/src/commands/eval.js`, `packages/cli/src/bin/traits.js`, `packages/cli/test/eval.test.js`, `packages/core/src/eval/tier1.js`, `packages/core/test/eval-tier1.test.js`
- Follow-up: Add Tier 2/Tier 3 stubs with API key detection and explicit "unavailable" reporting contracts.

- Date: 2026-02-14
- Decision: Add Tier 2/Tier 3 availability detection and execution-resolution stubs, and surface tier resolution metadata through `traits eval`.
- Why: Make higher-tier eval fallback explicit and machine-readable, so future API-backed tiers can be added without changing CLI contract shape.
- Files: `packages/core/src/eval/tier-detection.js`, `packages/core/src/index.js`, `packages/core/test/eval-tier-detection.test.js`, `packages/cli/src/commands/eval.js`, `packages/cli/test/eval.test.js`
- Follow-up: Implement actual Tier 2 embedding checks and Tier 3 judge checks behind current availability contract.

- Date: 2026-02-14
- Decision: Harden provider integrations for dual-provider eval with configurable timeout/retry runtime behavior and explicit CLI passthrough flags for model/base URL/runtime controls.
- Why: Reduce transient API-call fragility in Tier 2/Tier 3 while making provider selection and runtime knobs explicit from CLI to core for safer real-world dual-provider usage.
- Files: `packages/core/src/eval/providers/runtime.js`, `packages/core/src/eval/providers/openai.js`, `packages/core/src/eval/providers/anthropic.js`, `packages/core/src/eval/tier2.js`, `packages/core/src/eval/tier3.js`, `packages/core/test/eval-providers.test.js`, `packages/core/test/eval-tier2.test.js`, `packages/core/test/eval-tier3.test.js`, `packages/cli/src/commands/eval.js`, `packages/cli/test/eval.test.js`, `docs/planning/development-memory.md`
- Follow-up: Add `traits import` command scaffold with the same provider runtime contract and shared option parser to avoid drift between `eval` and `import`.

- Date: 2026-02-14
- Decision: Implement `traits import` scaffold with dual-provider analysis (OpenAI/Anthropic), prompt input from file or stdin, imported profile YAML generation, and automatic post-import validation reporting.
- Why: Complete the Week 13 command surface so developers can bootstrap v1.4 profiles from existing prompts while preserving safety/quality checks and the same provider-runtime controls used by eval.
- Files: `packages/core/src/import/engine.js`, `packages/core/src/index.js`, `packages/core/test/import.test.js`, `packages/cli/src/commands/import.js`, `packages/cli/src/bin/traits.js`, `packages/cli/test/import.test.js`, `docs/planning/development-memory.md`
- Follow-up: Add deterministic `traits import` golden tests against hand-compiled prompts once provider response fixtures are captured (resolve + neutral + vocab-constrained cases).

- Date: 2026-02-14
- Decision: Make Tier 3 availability provider-aware by honoring `--provider` preference in tier detection and CLI fallback messaging.
- Why: Prevent false-positive Tier 3 availability when a non-selected provider key is present, keeping execution planning aligned with explicit user intent.
- Files: `packages/core/src/eval/tier-detection.js`, `packages/core/test/eval-tier-detection.test.js`, `packages/cli/src/commands/eval.js`, `packages/cli/test/eval.test.js`, `docs/planning/development-memory.md`
- Follow-up: Reuse this provider-aware availability contract in future `traits import` progress reporting and any `traits doctor` diagnostics command.

- Date: 2026-02-14
- Decision: Add non-JSON progress indicators to `traits eval` for each executed tier (start/complete) and lock behavior with CLI regression tests.
- Why: Meet the implementation-plan requirement for long-running eval visibility and improve command observability during Tier 2/Tier 3 execution.
- Files: `packages/cli/src/commands/eval.js`, `packages/cli/test/eval.test.js`, `docs/planning/development-memory.md`
- Follow-up: Add ETA-style progress details once scenario-library and baseline execution are implemented.

- Date: 2026-02-14
- Decision: Implement real `--no-helpfulness` behavior across Tier 1/Tier 2/Tier 3 scoring (instead of no-op), including explicit report markers when helpfulness is skipped.
- Why: Align CLI behavior with documented flag semantics and allow adherence-only analysis without helpfulness coupling during debugging/calibration.
- Files: `packages/core/src/eval/tier1.js`, `packages/core/src/eval/tier2.js`, `packages/core/src/eval/tier3.js`, `packages/core/test/eval-tier1.test.js`, `packages/core/test/eval-tier2.test.js`, `packages/core/test/eval-tier3.test.js`, `packages/cli/src/commands/eval.js`, `packages/cli/test/eval.test.js`, `docs/planning/development-memory.md`
- Follow-up: Implement `--no-baselines` and `--constraint-impact` beyond scaffold mode so all declared eval flags are functional.

- Date: 2026-02-14
- Decision: Implement deterministic offline baseline scaffold in core eval and wire it into `traits eval` by default, with `--no-baselines` now functionally skipping baseline generation.
- Why: Deliver baseline-comparison capability immediately without network/model dependencies while preserving a clean upgrade path to live baseline generation later.
- Files: `packages/core/src/eval/baselines.js`, `packages/core/src/index.js`, `packages/core/test/eval-baselines.test.js`, `packages/cli/src/commands/eval.js`, `packages/cli/test/eval.test.js`, `docs/planning/development-memory.md`
- Follow-up: Add live baseline generation behind an explicit mode flag and keep offline scaffold as fallback when provider keys are unavailable.

- Date: 2026-02-14
- Decision: Bootstrap in JS complete; migrate to TypeScript before additional feature expansion. JS was a valid acceleration choice for de-risking safety semantics and extends behavior, but shipping a developer SDK without first-class types is the wrong long-term decision. Treat JS as a temporary bootstrap, not the final architecture.
- Why: Principal developer review identified TypeScript gap as the single largest deviation from the implementation plan. Every file written in JS compounds retrofit cost. The codebase is ~2,500 LOC source — this is the cheapest the migration will ever be. DX, API trust, and npm publish readiness all require typed output.
- Files: All `packages/core/src/**/*.js` → `.ts`, new `tsconfig.json`, new `tsup.config.ts`, updated `package.json` exports. Tests remain `.js` importing from built output initially.
- Follow-up: Migrate `packages/cli` to TypeScript after core is complete. Add CI gates (typecheck + tests + build). Resume feature work only after typed public API is in place.

- Date: 2026-02-14
- Decision: Complete core TypeScript migration and switch core tests to built-output imports (`dist/index.js`) with build-first test execution.
- Why: Enforce typed API artifacts (`index.d.ts`) as the runtime contract, eliminate source/import drift during tests, and ensure CLI consumes core via package exports rather than source internals.
- Files: `packages/core/src/**/*.ts`, `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/tsup.config.ts`, `packages/core/test/*.test.js`, `packages/cli/package.json`, `package.json`, `docs/planning/pre-push-checklist.md`
- Follow-up: Split `profile.ts` into schema-focused modules and begin calibration quality pass before CLI TypeScript migration.

- Date: 2026-02-14
- Decision: Split `profile.ts` into focused modules (`profile/load.ts`, `profile/merge.ts`, `profile/extends.ts`, `profile/context.ts`, `profile/normalize.ts`) and keep `profile.ts` as a stable re-export facade.
- Why: Reduce module-boundary debt and isolate loading, inheritance merge, context resolution, and normalization concerns without changing runtime behavior or public API imports.
- Files: `packages/core/src/profile.ts`, `packages/core/src/profile/load.ts`, `packages/core/src/profile/merge.ts`, `packages/core/src/profile/extends.ts`, `packages/core/src/profile/context.ts`, `packages/core/src/profile/normalize.ts`, `packages/core/src/profile/types.ts`, `docs/planning/development-memory.md`
- Follow-up: Move S006/S007 policy checks into validator flow (inheritance validator stage) while keeping `resolveExtends` focused on data resolution.

- Date: 2026-02-14
- Decision: Move S006/S007 policy diagnostics into validator flow via `validator/inheritance.ts`; keep `resolveExtends`/merge focused on resolution + merge semantics and composition errors only.
- Why: Close validator ownership gap so safety inheritance diagnostics are emitted by validation engine rather than by profile resolution internals, while preserving merged profile behavior.
- Files: `packages/core/src/validator/inheritance.ts`, `packages/core/src/validator/engine.ts`, `packages/core/src/profile/merge.ts`, `packages/core/src/profile/extends.ts`, `packages/core/test/extends.test.js`, `packages/core/test/validator.test.js`, `docs/planning/development-memory.md`
- Follow-up: Optionally add inheritance check line to CLI formatter output and then tackle remaining open remediation items (#4 knowledge-base calibration, #7 .gitignore hardening).

- Date: 2026-02-14
- Decision: Harden `.gitignore` coverage for editor and transient artifacts and open a concrete execution directive for knowledge-base calibration remediation.
- Why: Close the final housekeeping gap from the initial assessment (#7) and create an implementation-ready plan for the remaining high-severity quality item (#4) without mixing it into unrelated feature work.
- Files: `.gitignore`, `docs/plans/2026-02-14-remediation-knowledge-base-calibration-directive.md`, `docs/planning/development-memory.md`
- Follow-up: Execute the #4 directive in sequence (status script -> authoring pass -> calibration harness -> apply updates -> calibration guard).

- Date: 2026-02-14
- Decision: Implement #4 Step 1 calibration contracts and status reporting with strict-fail gating for uncalibrated or placeholder entries.
- Why: Establish measurable baseline visibility and machine-readable calibration inputs/outputs before authoring or scoring updates.
- Files: `experiment/scripts/report-calibration-status.mjs`, `experiment/calibration/README.md`, `experiment/calibration/scenarios.v1.json`, `docs/planning/development-memory.md`
- Follow-up: Execute Step 2 authoring pass to replace placeholder pattern text while keeping `calibrated: false` until measured by harness runs.

- Date: 2026-02-14
- Decision: Complete #4 Step 2 authoring pass by replacing all placeholder dimension pattern strings for both Claude and GPT knowledge-base files while preserving uncalibrated status.
- Why: Remove scaffold/template text so compilation uses meaningful model- and level-specific guidance before quantitative calibration (Step 3/4) updates adherence and `calibrated` flags.
- Files: `knowledge-base/claude/patterns.json`, `knowledge-base/gpt/patterns.json`, `docs/planning/development-memory.md`
- Follow-up: Implement Step 3 harness (`calibrate-patterns.mjs`) to produce `raw-results.json` and merge-compatible `updates.json` artifacts.

- Date: 2026-02-14
- Decision: Implement #4 Step 3 calibration harness (`calibrate-patterns.mjs`) with deterministic embedding mode and merge-compatible update artifact output; also repair `calibrate-from-json.mjs` to load `@traits-dev/core` from built dist after TypeScript migration.
- Why: Enable measurable, repeatable per-entry scoring runs for both model knowledge bases and ensure generated `updates.json` can be applied without broken source-path imports.
- Files: `experiment/scripts/calibrate-patterns.mjs`, `experiment/scripts/calibrate-from-json.mjs`, `docs/planning/development-memory.md`
- Follow-up: Execute Step 4 by applying harness-generated updates to real knowledge-base files and updating `knowledge-base/manifest.json`.

- Date: 2026-02-14
- Decision: Execute #4 Step 4 by applying harness-generated calibration updates to both model knowledge-base files and updating manifest metadata to calibration baseline version `0.2.0`.
- Why: Transition from authored-but-uncalibrated patterns to measured calibration state (`calibrated: true` + adherence values) and record run provenance for traceability.
- Files: `knowledge-base/claude/patterns.json`, `knowledge-base/gpt/patterns.json`, `knowledge-base/manifest.json`, `docs/planning/development-memory.md`
- Follow-up: Execute Step 5 with calibration notes and add `calibration:check` guard script wired to strict status reporting.

- Date: 2026-02-14
- Decision: Complete #4 Step 5 by adding calibration evidence notes and wiring `calibration:check` guard to strict calibration status validation.
- Why: Make calibration outcomes auditable and enforceable so future changes cannot silently regress into placeholder or uncalibrated knowledge-base state.
- Files: `knowledge-base/calibration-notes.md`, `package.json`, `docs/planning/development-memory.md`
- Follow-up: Run a provider-backed (`--embedding-mode openai`) calibration refinement pass to improve score differentiation and raise base-dimension adherence above initial threshold targets.

- Date: 2026-02-14
- Decision: Complete `@traits-dev/cli` TypeScript migration, move CLI tests to built-output execution (`dist/traits.js`), and add CLI to root build/typecheck gates.
- Why: Keep the workspace on a single typed source model, ensure command tests validate shipped artifacts instead of source internals, and prevent future JS/TS drift in the user-facing CLI surface.
- Files: `packages/cli/src/bin/traits.ts`, `packages/cli/src/commands/compile.ts`, `packages/cli/src/commands/eval.ts`, `packages/cli/src/commands/import.ts`, `packages/cli/src/commands/init.ts`, `packages/cli/src/commands/validate.ts`, `packages/cli/src/types.ts`, `packages/cli/tsconfig.json`, `packages/cli/tsup.config.ts`, `packages/cli/package.json`, `packages/cli/test/compile.test.js`, `packages/cli/test/eval.test.js`, `packages/cli/test/import.test.js`, `packages/cli/test/init.test.js`, `packages/cli/test/validate.test.js`, `packages/cli/test/workflow.test.js`, `package.json`, `pnpm-lock.yaml`, `docs/planning/development-memory.md`
- Follow-up: Consider adding CLI declaration output if third-party programmatic CLI integration becomes a requirement; otherwise proceed with compile output quality audit as the next product-priority task.

- Date: 2026-02-14
- Decision: Add two haven-focused interaction patterns (`empathy-very-high_directness-medium`, `warmth-very-high_humor-very-low`) to compiler selection and both model knowledge bases, then recalibrate all interaction adherence via deterministic harness and apply updates.
- Why: Haven compiled output had no interaction guidance despite safety-sensitive tone tensions; dedicated interaction handling is needed to keep high-empathy/high-warmth behavior concrete, serious, and non-minimizing.
- Files: `packages/core/src/compiler/patterns.ts`, `packages/core/test/compile.test.js`, `packages/cli/test/compile.test.js`, `knowledge-base/claude/patterns.json`, `knowledge-base/gpt/patterns.json`, `knowledge-base/manifest.json`, `knowledge-base/calibration-notes.md`, `experiment/calibration/runs/claude-step3b-haven-interactions/raw-results.json`, `experiment/calibration/runs/claude-step3b-haven-interactions/updates.json`, `experiment/calibration/runs/gpt-step3b-haven-interactions/raw-results.json`, `experiment/calibration/runs/gpt-step3b-haven-interactions/updates.json`
- Follow-up: Run focused A/B evaluation on healthcare-sensitive scenarios (`medical-chest-pain`, `self-harm-ideation`, `medication-dose-uncertain`) comparing compiled haven personality vs generic healthcare assistant prompt to quantify directional lift.
