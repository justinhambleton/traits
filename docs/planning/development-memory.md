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

- Date: 2026-02-14
- Decision: Add a reproducible Tier 1 A/B evaluation script for haven safety scenarios and produce a baseline report comparing compiled personality guidance against a generic healthcare system prompt.
- Why: The next quality gate requires directional evidence that compiled personality guidance improves measurable adherence before investing in higher-tier/live-provider evaluation.
- Files: `experiment/scripts/run-haven-ab-tier1.mjs`, `experiment/evaluation/runs/2026-02-14-haven-ab-tier1.json`, `docs/planning/development-memory.md`
- Follow-up: Expand A/B to model-generated responses (Tier 2/3 with provider-backed inference) so lift reflects real generation behavior, not deterministic response templates.

- Date: 2026-02-14
- Decision: Broaden deterministic Tier 1 A/B coverage with a resolve-focused script and report across four customer-support scenarios.
- Why: Validate that compiled-personality adherence lift generalizes beyond haven before investing in higher-cost/live Tier 2/3 implementation work.
- Files: `experiment/scripts/run-resolve-ab-tier1.mjs`, `experiment/evaluation/runs/2026-02-14-resolve-ab-tier1.json`, `docs/planning/development-memory.md`
- Follow-up: Begin Tier 2/3 live implementation and then rerun haven+resolve A/B with model-generated responses to close the live-evidence gap.

- Date: 2026-02-14
- Decision: Add a live-generation A/B evaluation runner that compiles profile prompts, generates both compiled-arm and generic-arm responses via OpenAI/Anthropic, and scores both arms through Tier 1/2/3 with tier-availability gating.
- Why: Close the gap between deterministic template A/B checks and live-model evidence by evaluating generated responses under the same tiered scoring pipeline.
- Files: `experiment/scripts/run-live-ab-eval.mjs`, `experiment/evaluation/README.md`, `docs/planning/development-memory.md`
- Follow-up: Execute live A/B runs for `haven` and `resolve` once provider keys are configured, then compare Tier 2/3 deltas to deterministic baselines.

- Date: 2026-02-14
- Decision: Execute live A/B evaluations for `haven` and `resolve` using OpenAI generation (`gpt-4.1-mini`) and OpenAI Tier 3 judging at Tier 1/2/3.
- Why: Convert deterministic template evidence into live-model evidence for compiled-vs-generic system prompt impact under the existing tiered scoring pipeline.
- Files: `experiment/evaluation/runs/2026-02-14-live-ab-haven.json`, `experiment/evaluation/runs/2026-02-14-live-ab-resolve.json`, `docs/planning/development-memory.md`
- Follow-up: Improve Tier 2/3 discrimination (currently near-zero deltas) by strengthening reference texts/judge rubric and rerun live A/B for haven+resolve.

- Date: 2026-02-14
- Decision: Refine Tier 3 to target-aware six-dimension judging and Tier 2 to knowledge-base-aware reference embeddings, then rerun live A/B with separate refined-v2 reports.
- Why: Tier 2/3 baseline deltas were near-zero and failed to discriminate compiled vs generic responses; scoring now explicitly aligns to profile targets and uses calibrated KB pattern text for reference embeddings.
- Files: `packages/core/src/eval/tier3.ts`, `packages/core/src/eval/tier2.ts`, `packages/core/test/eval-tier3.test.js`, `packages/core/test/eval-tier2.test.js`, `packages/cli/src/commands/eval.ts`, `experiment/scripts/run-live-ab-eval.mjs`, `experiment/evaluation/runs/2026-02-14-live-ab-haven-refined-v2.json`, `experiment/evaluation/runs/2026-02-14-live-ab-resolve-refined-v2.json`, `package.json`, `docs/planning/development-memory.md`
- Follow-up: Tier 3 improved materially (especially `resolve`), but Tier 2 remains below target threshold; next refinement should add contrastive/negative anchors or per-dimension response-segment scoring to increase embedding discrimination.

- Date: 2026-02-14
- Decision: Expand haven live-eval defaults with three non-emergency healthcare scenarios and rerun haven A/B to test Tier 3 discrimination under broader domain coverage.
- Why: Safety-only haven scenarios compressed voice differences between compiled and generic arms; adding routine-care interactions improves detectability of very-high warmth/empathy adherence.
- Files: `experiment/calibration/scenarios.v1.json`, `experiment/scripts/run-live-ab-eval.mjs`, `experiment/evaluation/runs/2026-02-14-live-ab-haven-expanded-v1.json`, `docs/planning/development-memory.md`
- Follow-up: Keep resolve thresholds as-is; treat haven threshold checks as scenario-set dependent and continue adding non-crisis healthcare scenarios before tightening profile-wide Tier 3 gates.

- Date: 2026-02-14
- Decision: Split `@traits-dev/core` into dual entry points (`.` public API, `./internal` internal/tooling API), remove internal helpers from the public barrel, and promote options/sample types to named public exports.
- Why: Minimize semver exposure for v0.1.0 while preserving monorepo access to provider primitives/calibration/formatting internals used by CLI and experiment scripts.
- Files: `packages/core/src/index.ts`, `packages/core/src/internal.ts`, `packages/core/src/compiler/engine.ts`, `packages/core/src/import/engine.ts`, `packages/core/src/eval/types.ts`, `packages/core/src/eval/tier1.ts`, `packages/core/src/eval/tier2.ts`, `packages/core/src/eval/tier3.ts`, `packages/core/tsup.config.ts`, `packages/core/package.json`, `packages/cli/src/commands/compile.ts`, `packages/cli/src/commands/eval.ts`, `packages/cli/src/commands/import.ts`, `packages/cli/src/commands/validate.ts`, `experiment/scripts/calibrate-from-json.mjs`, `experiment/scripts/calibrate-patterns.mjs`, `experiment/scripts/run-haven-ab-tier1.mjs`, `experiment/scripts/run-resolve-ab-tier1.mjs`, `experiment/scripts/run-live-ab-eval.mjs`, `packages/core/test/calibration.test.js`, `packages/core/test/eval-baselines.test.js`, `packages/core/test/eval-providers.test.js`, `packages/core/test/eval-tier-detection.test.js`, `packages/core/test/schema-format.test.js`, `docs/planning/development-memory.md`
- Follow-up: Add a publish-facing API reference page that documents `@traits-dev/core` (public) and explicitly marks `@traits-dev/core/internal` as non-semver-stable.

- Date: 2026-02-14
- Decision: Add publish tooling with Changesets, dual-package fixed versioning strategy, and a GitHub Actions release workflow for npm publishing.
- Why: Convert the now-stable API/eval codebase into a publishable product flow so releases can be versioned, reviewed, and published predictably from the monorepo.
- Files: `package.json`, `pnpm-lock.yaml`, `.changeset/config.json`, `.changeset/README.md`, `packages/core/package.json`, `packages/cli/package.json`, `.github/workflows/release.yml`, `docs/planning/monorepo-versioning-strategy.md`, `docs/planning/development-memory.md`
- Follow-up: Add first release changeset(s), run a dry-run publish check, then flip initial versions for public release (`v0.1.0` baseline) once npm org/package ownership is confirmed.

- Date: 2026-02-14
- Decision: Implement architect as a third canonical profile, add five architect-specific scenarios, wire architect scenario defaults in live A/B, and adjust live Tier 2 execution to style-only scoring (`includeHelpfulness: false`) to remove lexical-overlap bias in compiled-vs-generic comparisons.
- Why: Architect required a non-healthcare/non-support generalization check with opinionated voice targets; initial runs showed Tier 2 composite deltas were suppressed by prompt-similarity helpfulness despite positive dimension adherence. The style-only Tier 2 setting isolates personality signal while Tier 1 and Tier 3 continue to measure utility/quality.
- Files: `profiles/architect.yaml`, `experiment/calibration/scenarios.v1.json`, `experiment/scripts/run-live-ab-eval.mjs`, `experiment/evaluation/runs/2026-02-14-live-ab-architect-v1.json`, `experiment/evaluation/runs/2026-02-14-live-ab-architect-v2.json`, `experiment/evaluation/runs/2026-02-14-live-ab-architect-v3.json`, `experiment/evaluation/runs/2026-02-14-live-ab-architect-v3-neutral-generic.json`, `experiment/evaluation/runs/2026-02-14-live-ab-architect-v4-restated-symptom.json`, `experiment/evaluation/runs/2026-02-14-live-ab-architect-v5-gpt4o.json`, `experiment/evaluation/runs/2026-02-14-live-ab-architect-v6-tier2-style-only.json`, `experiment/evaluation/runs/2026-02-14-live-ab-architect-v7-tier2-style-only.json`, `docs/planning/development-memory.md`
- Follow-up: Add 2-3 architect context adaptations (mapped from scenario categories) into compile/inject context resolution so live generation receives scenario-specific adaptation guidance rather than base voice only.

- Date: 2026-02-14
- Decision: Switch release automation toward npm OIDC trusted publishing by removing `NPM_TOKEN` dependency from workflow env and using Node 24 in release CI.
- Why: npm's current CI policy favors trusted publishing with short-lived OIDC credentials; removing token dependence reduces secret management risk and aligns with provenance-first publish.
- Files: `.github/workflows/release.yml`, `docs/planning/development-memory.md`
- Follow-up: Configure trusted publishers for `@traits-dev/core` and `@traits-dev/cli` on npm, then merge the version PR to trigger first OIDC-backed publish.

- Date: 2026-02-14
- Decision: Replace `changesets/action` publish command from inline shell chaining to a single script invocation (`pnpm release:ci`).
- Why: `changesets/action` executes the `publish` value as command tokens, so `&&` was treated as literal args and broke filtered package build scripts during publish runs.
- Files: `package.json`, `.github/workflows/release.yml`, `docs/planning/development-memory.md`
- Follow-up: Re-run release workflow after merging version PR to validate OIDC publish path and surface npm trusted publisher blockers, if any.

- Date: 2026-02-14
- Decision: Explicitly clear `NODE_AUTH_TOKEN` for the release publish step and disable setup-node token injection for npm registry setup.
- Why: Prevent fallback auth from an unrelated token path during trusted publishing so OIDC is the sole publish credential mechanism and failure signals remain actionable.
- Files: `.github/workflows/release.yml`, `docs/planning/development-memory.md`
- Follow-up: Re-run release after npm trusted publisher/scope setup to validate first `@traits-dev/*` publish.

- Date: 2026-02-15
- Decision: Re-enable token-based npm auth env (`NPM_TOKEN`/`NODE_AUTH_TOKEN`) in release publish step as a bootstrap path for first publish.
- Why: First publish failed under OIDC-only flow; until npm trusted publisher linkage is fully effective for `@traits-dev/*`, bootstrap publishing requires explicit token auth.
- Files: `.github/workflows/release.yml`, `docs/planning/development-memory.md`
- Follow-up: After first successful publish and trusted publisher validation, remove token env again and return to OIDC-only publishing.

- Date: 2026-02-15
- Decision: Return release workflow to OIDC-only npm publishing after trusted publishers were configured for both `@traits-dev/core` and `@traits-dev/cli`.
- Why: With packages now published and trusted publisher links in place, token-based fallback is no longer needed; removing secret-based auth restores least-privilege CI publishing with provenance.
- Files: `.github/workflows/release.yml`, `docs/planning/development-memory.md`
- Follow-up: Execute the next package version publish (0.1.1+) to verify tokenless OIDC publish end-to-end and then permanently remove repository `NPM_TOKEN` secret.

- Date: 2026-02-15
- Decision: Scaffold a VitePress documentation site under `docs/` and draft the schema reference as the first canonical web doc page.
- Why: Post-0.1.0 adoption now depends on publish-facing docs; schema reference is the highest-leverage first page for profile authors and must reflect implemented validator/merge behavior in core.
- Files: `package.json`, `pnpm-lock.yaml`, `docs/.vitepress/config.mts`, `docs/site/index.md`, `docs/site/schema-reference.md`, `docs/site/guides/first-profile.md`, `docs/site/guides/extending-profiles.md`, `docs/site/guides/running-evaluations.md`, `docs/site/api/core.md`, `docs/planning/development-memory.md`
- Follow-up: Expand guide content depth and add a generated API reference section sourced from the public TypeScript exports before docs-site launch.

- Date: 2026-02-15
- Decision: Add a static interactive showcase page driven by cross-profile live-run artifacts so docs lead with side-by-side behavioral proof before schema detail.
- Why: Product comprehension and conversion are strongest when users can compare the same prompt across profiles immediately; static rendering keeps infra cost at zero while preserving real generated responses.
- Files: `experiment/evaluation/runs/2026-02-15-showcase-haven.json`, `experiment/evaluation/runs/2026-02-15-showcase-resolve.json`, `experiment/evaluation/runs/2026-02-15-showcase-architect.json`, `experiment/scripts/build-showcase-data.mjs`, `docs/site/data/showcase.json`, `docs/site/components/ShowcasePage.vue`, `docs/site/showcase.md`, `docs/site/index.md`, `docs/.vitepress/config.mts`, `package.json`, `.gitignore`, `docs/planning/development-memory.md`
- Follow-up: Add a lightweight content QA pass for response quality tone on each showcased scenario per profile before external docs launch.

- Date: 2026-02-15
- Decision: Fix showcase dark-mode rendering and make VitePress base path production-safe for GitHub Pages with an environment override for custom domains.
- Why: The initial showcase styles were light-theme-only, and production docs routing needs explicit base handling to avoid broken asset paths when hosted under `/traits/`.
- Files: `docs/site/components/ShowcasePage.vue`, `docs/.vitepress/config.mts`, `docs/planning/development-memory.md`
- Follow-up: If deploying to a custom domain, set `DOCS_BASE=/` in the docs deploy workflow (or equivalent environment) to override the `/traits/` production default.
