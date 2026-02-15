---
"@traits-dev/core": minor
"@traits-dev/cli": minor
---

Release v1.6 composition and compile budgeting features.

- Add schema `v1.6` support with array `extends` (`string | string[]`) and deterministic left-to-right parent-chain merge before child overlay.
- Add locked rule constraints for `behavioral_rules` and `capabilities.constraints` using rule objects (`{ rule, locked?: boolean }`) with merge-time lock preservation and S006 hard errors on locked inherited rule removal attempts.
- Add `traits compile --budget` token estimate output (chars/4) and `--budget-limit <tokens>` warning support (stderr), while keeping compiled prompt output unchanged.
