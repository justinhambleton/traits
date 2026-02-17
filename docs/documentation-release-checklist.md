# Documentation Release Checklist

This checklist is release-blocking for any user-facing package changes.

Use it for:

- New packages
- New commands/flags
- Public API additions or behavior changes
- Integration surface changes

No package publish should happen until all required items are complete.

## Required Surfaces

1. Root docs and discovery
- `README.md` package list, install snippets, quickstart paths
- `docs/site/overview.md` and `docs/site/quickstart.md` references
- `docs/.vitepress/config.mts` nav/sidebar links

2. Integration guidance
- `docs/site/guides/integrations.md` with concrete copy-paste examples
- `docs/site/guides/ci-cd.md` when release/automation behavior changes

3. Package-level docs
- `packages/<pkg>/README.md` with install, quickstart, API, and examples
- Any required runtime/configuration notes

4. API reference
- `docs/site/api/*.md` for new public package APIs
- Cross-links from relevant guides and root README

5. Release metadata
- Changeset present
- Docs build passes in CI before publish

## Release Plan: `@traits-dev/vercel` + `@traits-dev/mcp`

1. Root and discovery updates
- [x] Update `README.md` with `@traits-dev/vercel` and `@traits-dev/mcp`
- [x] Add/refresh "integration packages" references in `docs/site/overview.md`
- [x] Add quickstart entry points in `docs/site/quickstart.md`

2. Integration docs updates
- [x] Add `@traits-dev/vercel` usage in `docs/site/guides/integrations.md`
- [x] Add MCP server usage in `docs/site/guides/integrations.md`
- [x] Document Claude Desktop/Cursor MCP setup and expected URI/tool surface

3. Package documentation
- [x] Create/update `packages/vercel/README.md`
- [x] Create/update `packages/mcp/README.md`
- [x] Include runnable minimal examples and options tables

4. API docs and navigation
- [x] Add `docs/site/api/vercel.md`
- [x] Add `docs/site/api/mcp.md`
- [x] Add nav/sidebar links in `docs/.vitepress/config.mts`

5. Pre-publish validation
- [x] `pnpm build`
- [x] `pnpm typecheck`
- [x] `pnpm test`
- [x] `pnpm docs:build`
- [x] Manual sanity check: docs pages render and include new package links

## Sign-off

- Owner: ____________________
- Reviewer: ____________________
- Date: ____________________
- Publish approved: `yes / no`
