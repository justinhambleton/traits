# @traits-dev/mcp

MCP server for traits.dev profile resources and tools.

Exposes bundled starter profiles as resources and validate/compile operations as MCP tools.

## Run

```bash
npx -y @traits-dev/mcp
```

Binary name:

```bash
traits-mcp
```

## Claude Desktop config

```json
{
  "mcpServers": {
    "traits": {
      "command": "npx",
      "args": ["-y", "@traits-dev/mcp"]
    }
  }
}
```

## MCP surface

Tools:

- `traits_validate` -> `{ yaml: string, strict?: boolean }`
- `traits_compile` -> `{ yaml: string, model?: string, context?: object }`
- `traits_list_profiles` -> `{}`

Resources:

- `traits://profiles`
- `traits://profiles/{name}`
- `traits://profiles/{name}/compiled/{model}`

## Notes

- Bundled starter profiles are included in the package.
- Resource reads are for bundled profiles.
- For custom profiles, pass YAML content directly to `traits_validate` and `traits_compile`.

## Related docs

- Docs API: `docs/site/api/mcp.md`
- Integration guide: `docs/site/guides/integrations.md`
