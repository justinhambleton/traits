---
"@traits-dev/core": minor
"@traits-dev/cli": minor
---

Release 0.6.0 with the post-0.5.0 hardening and profile expansion work:

- Extend `traits migrate` to support `v1.5 -> v1.6` upgrades (with optional `--normalize-extends`).
- Expand `S008` action-claim scanning to additional profile text surfaces (`identity.backstory`, `context_adaptations.inject`).
- Upgrade docs playground behavior to use real in-browser compile + validate execution instead of static label replacement.
- Add `educator` and `advisor` starter profiles (`v1.6`) with built-in eval suites and CLI `--suite` support.
