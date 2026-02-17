# @traits-dev/mcp

## 0.2.0

### Minor Changes

- d14de2c: Add Vercel AI SDK middleware and MCP server packages

  - `@traits-dev/vercel`: One-line personality injection via `withPersonality()` for any Vercel AI SDK model. Uses `LanguageModelV3Middleware` with `transformParams` to prepend or merge compiled personality text into system messages.
  - `@traits-dev/mcp`: MCP server exposing `traits_validate`, `traits_compile`, and `traits_list_profiles` tools plus `traits://profiles` resources. Run via `npx @traits-dev/mcp` for Claude Desktop, Cursor, and other MCP clients.
