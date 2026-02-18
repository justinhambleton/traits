# Post-MVP Adoption & Hardening Sprint Plan

**Date:** 2026-02-17
**Sprint window:** 2026-02-24 to 2026-03-10 (2 weeks)
**Status:** Workstreams A/B/C complete — awaiting KPI measurement and retro (M3)
**Scope:** Post-launch quality, adoption readiness, and release gating for shipped MVP packages

---

## 1. Context

MVP delivery is complete for the originally scoped package set:

- `@traits-dev/core` (live)
- `@traits-dev/cli` (live)
- `@traits-dev/vercel` (live)
- `@traits-dev/mcp` (live)

This sprint focuses on reducing adoption friction and preventing documentation drift ahead of the next publish cycle.

---

## 2. Sprint Goals

1. Make first-use integration successful with minimal guesswork.
2. Ensure docs stay release-blocking for all user-facing changes.
3. Add consumer-level confidence checks beyond monorepo tests.

### Non-goals (explicit)

- No schema `v1.7` feature work in this sprint.
- No new starter profile expansion in this sprint.
- No net-new package creation.

---

## 3. Owners

| Area | Owner | Backup | Decision Authority |
|---|---|---|---|
| Sprint DRI / Go-No-Go | Justin Hambleton | None | Final release readiness |
| Documentation (site + root docs) | Justin Hambleton | None | Content and IA decisions |
| Package docs (`packages/*/README.md`) | Justin Hambleton | None | API/examples accuracy |
| CI/release gating | Justin Hambleton | None | Required checks before publish |
| Consumer smoke validation | Justin Hambleton | None | Pass/fail criteria |

If additional contributors join, assign backups during sprint kickoff and update this table.

---

## 4. Workstreams

### Workstream A: Documentation Completeness & Discoverability

**Owner:** Justin Hambleton

### Checklist

- [x] Root `README.md` includes all four packages with install + usage entry points.
- [x] Docs navigation includes API entries for `core`, `vercel`, and `mcp`.
- [x] Integration guide includes copy-paste flows for:
  - [x] `@traits-dev/vercel` wrapper usage
  - [x] `@traits-dev/mcp` run/configuration usage
- [x] Quickstart includes explicit paths for Vercel and MCP usage.
- [x] Package-level READMEs exist and are aligned with published package behavior:
  - [x] `packages/vercel/README.md`
  - [x] `packages/mcp/README.md`
- [x] CI/CD guide explicitly documents docs gate before publish.
- [x] No broken internal docs links on updated pages.

### Acceptance Criteria

- `pnpm docs:build` passes.
- Link sanity pass reports zero broken links on changed docs pages.
- All user-facing commands/snippets in new docs are syntax-valid and align with package APIs.

---

### Workstream B: Consumer Confidence (Outside Monorepo)

**Owner:** Justin Hambleton

### Checklist

- [x] Add a documented smoke-check process for clean consumer environments.
- [x] Validate `@traits-dev/vercel` install + type resolution + basic wrapper execution from npm.
- [x] Validate `@traits-dev/mcp` install + startup + tool/resource surface from npm.
- [x] Verify published tarballs include expected artifacts:
  - [x] `README.md`
  - [x] `dist/*`
  - [x] `profiles/*.yaml` (for `@traits-dev/mcp`)
- [x] Record one reproducible command set for post-publish verification.

### Acceptance Criteria

- Consumer smoke checks pass for both `@traits-dev/vercel` and `@traits-dev/mcp`.
- Published package metadata matches intended contract (`main`, `types`, `exports`/`bin`, dependencies).
- Post-publish verification can be run in under 10 minutes with a single checklist.

---

### Workstream C: Release Process Hardening

**Owner:** Justin Hambleton

### Checklist

- [x] Release workflow includes docs build gate.
- [x] `release:ci` script includes docs build gate.
- [x] PR template requires documentation checklist for user-facing changes.
- [x] Contributing guide states docs are release-blocking for user-facing changes.
- [x] Release documentation checklist is available and used before any publish.

### Acceptance Criteria

- CI blocks publish when docs build fails.
- PRs touching public behavior include docs checklist completion or explicit rationale.
- Next publish readiness review has written sign-off against checklist.

---

## 5. Milestones & Dates

### Milestone 1 (by 2026-02-27) — COMPLETE 2026-02-17

- [x] Workstream A substantially complete.
- [x] Workstream C gates merged.

### Milestone 2 (by 2026-03-05) — COMPLETE 2026-02-17

- [x] Workstream B smoke checks complete and documented.
- [x] Dry-run post-publish verification executed once (`scripts/post-publish-verify.sh`).

### Milestone 3 (by 2026-03-10) — IN PROGRESS

- [x] All workstream acceptance criteria met.
- [ ] KPI 2 (Docs Completion Time) manual walkthrough.
- [ ] KPI 3 (First Successful Run Rate) example verification pass.
- [ ] Sprint retro and prioritized backlog for next phase prepared.

---

## 6. Release Gate for Next Package Publish

Before any release after `0.2.0`, all of the following must be true:

- [ ] `pnpm build`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm docs:build`
- [ ] Documentation checklist signed in `docs/documentation-release-checklist.md`
- [ ] Consumer smoke checks completed for affected packages
- [ ] Changeset present and accurate

If any box is unchecked, release is **no-go**.

---

## 7. Risks & Mitigations

1. **Risk:** Docs drift from runtime behavior.
- **Mitigation:** Keep examples in same PR as behavior changes; require checklist sign-off.

2. **Risk:** Monorepo tests pass but npm consumer install/runtime fails.
- **Mitigation:** Maintain clean-environment smoke checks as release gate.

3. **Risk:** Scope creep into schema/features delays adoption work.
- **Mitigation:** Enforce non-goals; move v1.7 ideas to separate planning doc.

---

## 8. Reporting Cadence

- Daily: short status update (completed, in progress, blocked).
- Mid-sprint checkpoint (2026-03-03): acceptance-criteria progress review.
- End-of-sprint review (2026-03-10): final checklist sign-off and next-phase recommendation.

---

## 9. Launch KPIs

Three metrics to measure adoption readiness at sprint close (March 10, 2026):

### KPI 1: Install Success Rate
**Definition:** Percentage of clean `npm install` attempts that resolve, install, and import without errors across all 4 packages.
**Measurement:** Consumer smoke checks from clean Node.js environments (no monorepo context). Run against latest published versions on npm.
**Target:** 100% — every package installs and its public exports resolve on first try.
**How to test:** Automated CI job that creates a temp project, installs each package, and runs a minimal import (`import { ... } from "@traits-dev/core"`, etc.).

### KPI 2: Docs Completion Time
**Definition:** Time for a new developer to go from zero to a working integration using only published documentation.
**Measurement:** Timed walkthrough of the quickstart and integration guides. Clock starts at the docs homepage, ends at a successful `compileProfile()` or `withPersonality()` call producing output.
**Target:** Under 5 minutes for core quickstart, under 10 minutes for vercel or mcp integration.
**How to test:** Manual walkthrough by someone unfamiliar with the codebase, following only docs. Record blockers and time.

### KPI 3: First Successful Run Rate
**Definition:** Percentage of documented examples that produce the expected output on first execution without modification.
**Measurement:** Run every code example in the docs and package READMEs verbatim. Track pass/fail.
**Target:** 100% — every published example runs as-is.
**How to test:** CI job or manual pass that copies each example into a fresh project and executes it. Any example that requires undocumented steps or produces errors is a failure.

---

## 10. Definition of Done

Sprint is complete only when:

- All 3 launch KPIs meet their targets.

- Every workstream acceptance criterion is satisfied.
- Release gate checklist is fully green.
- Verification evidence is recorded in commit/PR notes for traceability.
