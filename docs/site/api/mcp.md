# `@traits-dev/mcp` API Reference

MCP server package exposing traits profile operations as tools/resources.

## Install or run

Run directly:

```bash
npx -y @traits-dev/mcp
```

Or install:

```bash
npm i -D @traits-dev/mcp
traits-mcp
```

## Client configuration

### Claude Desktop

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

### Cursor / other MCP clients

Use the same command/args pair:

- `command`: `npx`
- `args`: `["-y", "@traits-dev/mcp"]`

## MCP surface

### Tools

| Tool | Input | Description |
|------|-------|-------------|
| `traits_validate` | `{ yaml: string, strict?: boolean }` | Validate profile YAML against schema + safety checks |
| `traits_compile` | `{ yaml: string, model?: string, context?: object }` | Compile profile YAML into personality prompt text |
| `traits_list_profiles` | `{}` | List bundled starter profiles and metadata |

### Resources

| Resource URI | Description |
|-------------|-------------|
| `traits://profiles` | List bundled starter profiles |
| `traits://profiles/{name}` | Read bundled profile YAML source |
| `traits://profiles/{name}/compiled/{model}` | Read bundled profile compiled text for target model |

## Bundling and profile behavior

- The server ships with bundled starter profiles.
- Resource reads are limited to bundled profiles.
- Tool calls accept raw YAML strings, so custom user profiles do not require filesystem access.
- Custom profile workflows should call `traits_validate` / `traits_compile` with YAML content directly.

## Examples

### Validate custom YAML through tool call

```json
{
  "name": "traits_validate",
  "arguments": {
    "yaml": "schema: \"v1.6\"\nmeta:\n  name: \"Demo\"\n  version: \"1.0\"\n  description: \"demo\"\nidentity:\n  role: \"assistant\"\nvoice:\n  formality: medium\n  warmth: medium\n  verbosity: low\n  directness: high\n  empathy: medium\n  humor: low\n",
    "strict": true
  }
}
```

### Read compiled bundled profile text

Resource URI:

```text
traits://profiles/resolve/compiled/gpt-4o
```

## Related docs

- [Integration Recipes](/guides/integrations)
- [CLI Reference](/reference/cli)
- [Core API](/api/core)
