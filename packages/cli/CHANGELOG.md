# @traits-dev/cli

## 0.7.4

### Patch Changes

- Updated dependencies [37925e1]
  - @traits-dev/core@0.7.4

## 0.7.3

### Patch Changes

- Updated dependencies [60cc340]
  - @traits-dev/core@0.7.3

## 0.7.2

### Patch Changes

- Updated dependencies [e6f658f]
  - @traits-dev/core@0.7.2

## 0.7.1

### Patch Changes

- Updated dependencies [83eef7a]
  - @traits-dev/core@0.7.1

## 0.7.0

### Minor Changes

- 16fb191: Release 0.7.0 synchronized with core Tier 1 calibration improvements and playground/docs workflow updates.

### Patch Changes

- Updated dependencies [16fb191]
  - @traits-dev/core@0.7.0

## 0.6.0

### Minor Changes

- 66590cb: Release 0.6.0 with the post-0.5.0 hardening and profile expansion work:

  - Extend `traits migrate` to support `v1.5 -> v1.6` upgrades (with optional `--normalize-extends`).
  - Expand `S008` action-claim scanning to additional profile text surfaces (`identity.backstory`, `context_adaptations.inject`).
  - Upgrade docs playground behavior to use real in-browser compile + validate execution instead of static label replacement.
  - Add `educator` and `advisor` starter profiles (`v1.6`) with built-in eval suites and CLI `--suite` support.

### Patch Changes

- Updated dependencies [66590cb]
  - @traits-dev/core@0.6.0

## 0.5.0

### Minor Changes

- cf1be66: Complete Phase 5 roadmap delivery for schema migration and CI security reporting.

  - Add `traits migrate` command to upgrade profiles from `v1.4` to `v1.5` non-destructively (default output file) with optional in-place overwrite.
  - Add `traits validate --format sarif` output for CI/code scanning integrations (SARIF 2.1.0).

### Patch Changes

- Updated dependencies [cf1be66]
  - @traits-dev/core@0.5.0

## 0.4.0

### Minor Changes

- fe4ed13: Release v1.6 composition and compile budgeting features.

  - Add schema `v1.6` support with array `extends` (`string | string[]`) and deterministic left-to-right parent-chain merge before child overlay.
  - Add locked rule constraints for `behavioral_rules` and `capabilities.constraints` using rule objects (`{ rule, locked?: boolean }`) with merge-time lock preservation and S006 hard errors on locked inherited rule removal attempts.
  - Add `traits compile --budget` token estimate output (chars/4) and `--budget-limit <tokens>` warning support (stderr), while keeping compiled prompt output unchanged.

### Patch Changes

- Updated dependencies [fe4ed13]
  - @traits-dev/core@0.4.0

## 0.3.0

### Minor Changes

- e0497b0: Release eval hardening updates for CI workflows and baseline scenario coverage.

  - Add `traits eval --format json` and `traits eval --format junit` output modes.
  - Add configurable JUnit thresholds with `--junit-threshold` plus per-tier overrides (`--junit-threshold-tier1`, `--junit-threshold-tier2`, `--junit-threshold-tier3`).
  - Add built-in baseline scenario suites for `support`, `healthcare`, and `developer`, with `--suite <name>` selection in `traits eval`.
  - Add Tier 2 and Tier 3 interpretation caveats to human-readable eval output.

### Patch Changes

- Updated dependencies [e0497b0]
  - @traits-dev/core@0.3.0

## 0.2.0

### Minor Changes

- 8f9de21: Ship v1.5 voice-policy hardening updates focused on capability honesty and grounding.

  - Add schema `v1.5` support with `capabilities` (`tools`, `constraints`, `handoff`) for explicit capability boundaries.
  - Add validator check `S008` to warn on action-claiming behavioral policy language without matching declared tools.
  - Add compiler `[CAPABILITY BOUNDARIES]` output block so compiled prompts include tools, constraints, and handoff policy.
  - Regenerate showcase/docs content and reposition product language around voice and behavioral policy governance.

### Patch Changes

- Updated dependencies [8f9de21]
  - @traits-dev/core@0.2.0

## 0.1.0

### Minor Changes

- 1e610e1: Initial publish-ready release for traits.dev with dual-package TypeScript support.

  `@traits-dev/core` includes validated profile loading/extends resolution, compile and inject flows, S006/S007 safety ownership in validator, calibrated knowledge-base integration, and tiered evaluation (Tier 1/2/3) with public/internal API split.

  `@traits-dev/cli` includes typed command workflows for `init`, `validate`, `compile`, `eval`, and `import`, aligned to built core output and release packaging boundaries.

### Patch Changes

- Updated dependencies [1e610e1]
  - @traits-dev/core@0.1.0
