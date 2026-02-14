# traits.dev Codex Working Agreement

This file defines default execution practices for Codex work in this repository.

## Source of Truth

Use these as canonical in this order:

1. `docs/plans/2026-02-12-feat-traits-dev-mvp-implementation-plan.md`
2. `docs/planning/personality-profiles-spec.md`
3. `profiles/*.yaml` and `profiles/test-fixtures/*.yaml`

If another planning doc conflicts with the above, treat it as historical context.

## Default Workflow

1. Resolve the target behavior in the source-of-truth docs before editing code.
2. Implement from profile artifacts (`profiles/*.yaml`), not copied snippets from prose sections.
3. Run focused tests/checks after each change set; do not batch many risky edits without verification.
4. Keep changes small and composable; prefer additive edits over broad rewrites.
5. Record key decisions in `docs/planning/development-memory.md`.

## MCP, Skills, and Research

1. Use `context7` MCP for framework/API reference checks when external docs are needed.
2. Use `$skill-creator` when creating or updating Codex skills.
3. Use `$skill-installer` when installing curated or external skills.
4. Prefer primary docs/specs over secondary summaries.

## Validator/Compiler Guardrails

1. Preserve deterministic merge behavior for `extends` and `_remove` semantics.
2. Treat safety checks as product behavior, not optional linting.
3. Do not weaken S006/S007 semantics without explicit decision log entry.
4. Keep compile-time and inject-time responsibilities non-overlapping.

## Definition of Done (per implementation unit)

1. Behavior is implemented and verified with at least one targeted test.
2. Relevant docs are updated when contracts change.
3. Decision and rationale are captured in memory log.
4. Any deferred risk is explicitly listed.
