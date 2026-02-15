# Run Evaluations

traits.dev supports three evaluation tiers.

## Tier summary

- Tier 1: deterministic lexical/structure checks
- Tier 2: embedding-based style adherence
- Tier 3: judge-model target adherence

## CLI examples

```bash
pnpm exec traits eval profiles/resolve.yaml --tier 1
pnpm exec traits eval profiles/resolve.yaml --tier 2 --provider openai
pnpm exec traits eval profiles/resolve.yaml --tier 3 --provider openai
```

## Provider keys

- Tier 2 currently requires an embedding provider key.
- Tier 3 requires a judge-model provider key.
- Missing credentials gracefully downgrade available tiers.

## CI recommendation

- Gate on Tier 1 for every pull request.
- Run Tier 2/3 on schedule or release candidates.
