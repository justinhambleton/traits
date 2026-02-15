# Extend Profiles Safely

Use `extends` to create variants without copying full profiles.

## Base pattern

```yaml
schema: "v1.4"
extends: "resolve"
meta:
  name: "resolve-enterprise"
```

## Rules that matter

- Safety arrays append by default; they do not silently replace parent values.
- `context_adaptations` merge by `when` key.
- Use `_remove` keys only when intentional and auditable.

## Important diagnostics

- `S006` warns when you remove safety-relevant parent constraints.
- `S006` errors if merged safety constraints are fewer than parent.
- `S007` warns when safety-critical adaptations are missing priority (`100` expected).

## Recommended workflow

1. Validate parent.
2. Validate child.
3. Validate child with `--strict`.
4. Compile and inspect trace output.
