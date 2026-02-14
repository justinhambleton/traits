# Monorepo Versioning Strategy (v0.1.0)

## Scope

This strategy applies to:

- `@traits-dev/core`
- `@traits-dev/cli`

## Policy

1. Fixed versioning group:
   - `@traits-dev/core` and `@traits-dev/cli` are versioned together using Changesets `fixed`.
2. Public API contract:
   - `@traits-dev/core` (`.` export) is semver-stable.
   - `@traits-dev/core/internal` is monorepo/internal-only and not semver-stable for external consumers.
3. Publish access:
   - Both packages publish as npm public packages.
4. Internal dependency updates:
   - Changesets updates internal dependency ranges with `updateInternalDependencies: "patch"`.

## Release Flow

1. Add one or more `.changeset/*.md` files in feature/fix PRs.
2. Merge to `main`.
3. Release workflow runs:
   - `pnpm build`
   - `pnpm typecheck`
   - `pnpm test`
   - Changesets action:
     - opens/updates release PR with bumped versions and changelog updates, or
     - publishes when release PR has already been merged.

## Required Secrets

- `NPM_TOKEN` for npm publishing.
- `GITHUB_TOKEN` (provided by Actions) for release PR automation.

