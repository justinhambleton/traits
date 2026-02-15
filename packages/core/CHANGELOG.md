# @traits-dev/core

## 0.2.0

### Minor Changes

- 8f9de21: Ship v1.5 voice-policy hardening updates focused on capability honesty and grounding.

  - Add schema `v1.5` support with `capabilities` (`tools`, `constraints`, `handoff`) for explicit capability boundaries.
  - Add validator check `S008` to warn on action-claiming behavioral policy language without matching declared tools.
  - Add compiler `[CAPABILITY BOUNDARIES]` output block so compiled prompts include tools, constraints, and handoff policy.
  - Regenerate showcase/docs content and reposition product language around voice and behavioral policy governance.

## 0.1.0

### Minor Changes

- 1e610e1: Initial publish-ready release for traits.dev with dual-package TypeScript support.

  `@traits-dev/core` includes validated profile loading/extends resolution, compile and inject flows, S006/S007 safety ownership in validator, calibrated knowledge-base integration, and tiered evaluation (Tier 1/2/3) with public/internal API split.

  `@traits-dev/cli` includes typed command workflows for `init`, `validate`, `compile`, `eval`, and `import`, aligned to built core output and release packaging boundaries.
