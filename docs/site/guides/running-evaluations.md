# Run Evaluations

traits.dev supports three evaluation tiers.

## Tier summary

1. Tier 1: deterministic vocabulary/structure/helpfulness checks.
2. Tier 2: embedding similarity against target-dimension reference patterns.
3. Tier 3: judge-model scoring against explicit voice-target adherence rubric.

## CLI examples

```bash
pnpm exec traits eval profiles/resolve.yaml --tier 1
pnpm exec traits eval profiles/resolve.yaml --tier 2 --provider openai
pnpm exec traits eval profiles/resolve.yaml --tier 3 --provider openai
```

## Provider keys

1. Tier 2 requires OpenAI embeddings (`TRAITS_OPENAI_API_KEY`) unless a custom embedding function is provided.
2. Tier 3 requires OpenAI or Anthropic judge credentials.
3. Missing credentials downgrade execution to available tiers instead of hard-failing the CLI.

## How to interpret scores

1. Tier 1 is the reliability gate for fast regressions and policy drift.
2. Tier 2 is directional style signal, not final truth.
3. Tier 3 is the highest-fidelity adherence signal but still judge-model-based.

Important caveat: Tier 3 is directionally useful but noisy. Do not use Tier 3 alone as a merge gate.

## CI recommendation

1. Require Tier 1 on every pull request.
2. Run Tier 2/3 on scheduled jobs or release candidates.
3. Fail release readiness when Tier 1 regresses and investigate Tier 2/3 deltas as quality signals.
