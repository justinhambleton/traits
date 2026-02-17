# Contributing to traits.dev

Thanks for contributing. This repository is a pnpm monorepo for:

- `@traits-dev/core` (SDK runtime)
- `@traits-dev/cli` (CLI)
- `docs/` (VitePress docs)
- `profiles/`, `knowledge-base/`, and `experiment/` (artifacts and evaluation tooling)

## Development setup

```bash
pnpm install
pnpm build
pnpm typecheck
pnpm test
```

For docs work:

```bash
pnpm docs:dev
```

## Contribution workflow

1. Create a branch from `main`.
2. Make the smallest coherent change set.
3. Add or update tests for behavior changes.
4. Run the required checks locally.
5. Open a PR with a clear summary and validation evidence.

## Required local checks

Run these before opening or updating a PR:

```bash
pnpm build
pnpm typecheck
pnpm test
```

If your change touches public package/API/CLI/integration behavior:

```bash
pnpm docs:build
```

If your change touches showcase artifacts:

```bash
pnpm showcase:build
```

## Release-blocking documentation gate

For user-facing package changes, documentation updates are required before publish.

Use the checklist in `docs/documentation-release-checklist.md` and complete all required sections for:

- root README/discovery surfaces
- integration guides
- package READMEs
- API reference pages and navigation links
- docs build verification

## Engineering expectations

- Keep runtime behavior deterministic where possible.
- Preserve safety semantics (`S001`-`S008`) when touching schema, merge, validator, compiler, or eval logic.
- Treat docs updates as release-blocking when schema, CLI flags, public API behavior, or integration surfaces change.
- For significant implementation decisions, append an entry to `docs/planning/development-memory.md`.

## Tests

- Add unit tests for all new behavior and regressions.
- Prefer fixture-driven tests for profile merge/inheritance/safety changes.
- Do not remove or loosen safety-related assertions without explicit rationale.

## Commit and PR conventions

- Use concise, scoped commit messages (for example: `feat: ...`, `fix: ...`, `docs: ...`, `chore: ...`).
- Keep unrelated changes out of the same PR.
- Include:
  - Problem statement
  - What changed
  - Validation commands and results
  - Any follow-up work

## Release notes

User-facing changes should include a changeset:

```bash
pnpm changeset
```

Changesets drive versioning and npm release automation.
