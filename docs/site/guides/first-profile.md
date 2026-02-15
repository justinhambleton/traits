# Write Your First Profile

Use this flow for a first pass.

## 1. Generate a starter

```bash
pnpm exec traits init --template resolve my-profile.yaml
```

## 2. Edit identity and voice

Set:

- `meta.name`, `meta.description`
- `identity.role`
- `voice` dimensions

Keep changes small on the first iteration.

## 3. Validate

```bash
pnpm exec traits validate my-profile.yaml
pnpm exec traits validate my-profile.yaml --strict
```

## 4. Compile

```bash
pnpm exec traits compile my-profile.yaml --model claude-sonnet-4
pnpm exec traits compile my-profile.yaml --model gpt-4o
```

## 5. Evaluate

```bash
pnpm exec traits eval my-profile.yaml --tier 1
```

Next: [Extend Profiles Safely](/guides/extending-profiles)
