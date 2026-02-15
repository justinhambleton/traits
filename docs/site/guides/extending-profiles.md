# Extend Profiles Safely

Use `extends` when you want controlled reuse without copy-pasting full YAML.

`extends` supports:

- `extends: "brand-base"` (single parent)
- `extends: ["brand-base", "domain-health", "channel-chat"]` (`v1.6`; merged left to right, then child)

## Example: `brand-base` -> `domain-health`

Parent (`brand-base.yaml`):

```yaml
schema: "v1.5"
meta:
  name: "brand-base"
  version: "1.0.0"
  description: "Shared brand voice policy"
identity:
  role: "Brand assistant"
voice:
  formality: "medium"
  warmth: "high"
  verbosity: "medium"
  directness: "medium"
  empathy: "high"
  humor:
    target: "very-low"
    style: "none"
behavioral_rules:
  - "Acknowledge user goals before proposing actions"
capabilities:
  tools: []
  constraints:
    - "Never claim actions without tool confirmation."
  handoff:
    trigger: "Request needs unavailable operations."
    action: "Offer handoff to a human operator."
```

Child (`domain-health.yaml`):

```yaml
schema: "v1.5"
extends: "brand-base"
meta:
  name: "domain-health"
  description: "Healthcare-safe variant"
voice:
  directness:
    target: "medium"
    adapt: true
    floor: "low"
    ceiling: "medium"
behavioral_rules:
  - "Never diagnose; frame guidance as context for professional care"
context_adaptations:
  - when: "crisis_indicators"
    priority: 100
    inject:
      - "Provide emergency and crisis resources immediately"
```

## Merge behavior to remember

1. `meta`, `identity`: field-level merge.
2. `voice`: child replaces each dimension it sets.
3. `behavioral_rules`: append with dedup.
4. `vocabulary.preferred_terms` / `forbidden_terms`: append with case-insensitive dedup.
5. `context_adaptations`: merge by `when` key (same key replaced, new key appended).
6. `capabilities`: tools/constraints append with dedup; `handoff` fields are child-over-parent.

## Removal escape hatches

Use removals only when there is an explicit policy reason:

- `behavioral_rules_remove`
- `vocabulary.preferred_terms_remove`
- `vocabulary.forbidden_terms_remove`
- `context_adaptations_remove`

For `schema: "v1.6"`, behavioral rules can use object entries with `locked: true`.
Locked inherited rules cannot be removed by `behavioral_rules_remove`; validator emits `S006` error.

## Safety diagnostics in inheritance

1. `S006` warns on safety-relevant removals and errors on net safety regression.
2. `S007` warns when safety-named adaptations are missing `priority: 100`.

## Recommended workflow

```bash
pnpm exec traits validate brand-base.yaml
pnpm exec traits validate domain-health.yaml
pnpm exec traits validate domain-health.yaml --strict
pnpm exec traits compile domain-health.yaml --model gpt-4o
```
