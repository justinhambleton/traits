---
"@traits-dev/core": minor
"@traits-dev/cli": minor
---

Release eval hardening updates for CI workflows and baseline scenario coverage.

- Add `traits eval --format json` and `traits eval --format junit` output modes.
- Add configurable JUnit thresholds with `--junit-threshold` plus per-tier overrides (`--junit-threshold-tier1`, `--junit-threshold-tier2`, `--junit-threshold-tier3`).
- Add built-in baseline scenario suites for `support`, `healthcare`, and `developer`, with `--suite <name>` selection in `traits eval`.
- Add Tier 2 and Tier 3 interpretation caveats to human-readable eval output.
