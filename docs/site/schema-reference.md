# Voice Profile & Behavioral Policy Schema Reference (`v1.5`)

This page documents the implemented voice profile and behavioral policy schema used by `@traits-dev/core`.

## Schema version

- Supported: `schema: "v1.4"` and `schema: "v1.5"`.
- Any other schema value fails validation (`V001`).
- `capabilities` is available only in `v1.5`.

## Top-level structure

Required sections:

- `schema`
- `meta`
- `identity`
- `voice`

Optional sections:

- `vocabulary`
- `behavioral_rules`
- `context_adaptations`
- `capabilities` (`v1.5` only)
- `localization`
- `channel_adaptations`
- `extends`
- `behavioral_rules_remove`
- `context_adaptations_remove`

Unknown top-level keys fail validation (`V001`).

## `meta`

Required fields:

- `name: string`
- `version: string`
- `description: string`

Optional fields:

- `tags: string[]`
- `target_audience: string`
- Additional keys allowed

## `identity`

Required fields:

- `role: string`

Optional fields:

- `backstory: string`
- `expertise_domains: string[]`
- Additional keys allowed

## Voice dimensions

The schema has 6 dimensions:

- `formality`
- `warmth`
- `verbosity`
- `directness`
- `empathy`
- `humor`

All dimensions use 5 discrete levels:

- `very-low`
- `low`
- `medium`
- `high`
- `very-high`

Each dimension accepts either:

1. Shorthand level string:

```yaml
directness: high
```

2. Object form:

```yaml
directness:
  target: high
  adapt: true
  floor: medium
  ceiling: very-high
```

Object-form rules:

- `target` is required and must be a valid level.
- `adapt` is optional boolean.
- If `adapt: true`, both `floor` and `ceiling` are required.
- Adaptive ranges must satisfy `floor <= target <= ceiling`.

Humor-specific rule:

- `voice.humor` may include `style` with one of:
  - `none`
  - `dry`
  - `subtle-wit`
  - `playful`
- `style` on non-humor dimensions is invalid.

## `vocabulary`

Optional object with:

- `preferred_terms: string[]`
- `forbidden_terms: string[]`
- `preferred_terms_remove: string[]` (extends-only removal escape hatch)
- `forbidden_terms_remove: string[]` (extends-only removal escape hatch)

## `behavioral_rules`

- Optional `string[]`
- Rules are included in compile output and safety-scanned.

## `capabilities` (`v1.5`)

Optional object (only valid when `schema: "v1.5"`):

```yaml
capabilities:
  tools:
    - "account_lookup"
  constraints:
    - "Never claim actions without tool confirmation."
  handoff:
    trigger: "Request exceeds defined capabilities"
    action: "Acknowledge limitation and offer human handoff"
```

Fields:

- `tools: string[]`
- `constraints: string[]`
- `handoff.trigger: string`
- `handoff.action: string`

Compiler behavior:

- When present, compile output includes a `[CAPABILITY BOUNDARIES]` section with tools, constraints, and handoff policy.

## `context_adaptations`

Optional array of:

```yaml
- when: frustrated_user
  priority: 10
  adjustments:
    warmth: high
    directness: medium
  inject:
    - "Acknowledge frustration before proposing next steps."
```

Fields:

- `when: string` required
- `adjustments?: Partial<Record<DimensionName, DimensionValue>>`
- `inject?: string[]`
- `priority?: number` (default `0`)

Important: `adjustments` is optional; inject-only adaptations are valid.

## Context conflict resolution semantics

When multiple adaptations are active:

1. Sort by `priority` ascending (lower first, higher later).
2. For equal priority, keep original array order (later items apply later).
3. Apply `adjustments` in order; last write wins per dimension.
4. Collect `inject` rules from all matches in order (no dedup).

Net effect: higher priority overrides lower priority deterministically.

## `extends` and merge semantics

`extends` is single-inheritance. Child resolution order is:

1. Sibling directory of the child profile.
2. Bundled starter profiles (`profiles/` in the SDK package).

Merge rules:

- `meta`: field-level merge; `tags` append + case-insensitive dedup
- `identity`: field-level merge
- `voice`: dimension-level replace
- `behavioral_rules`: append + exact dedup
- `vocabulary.forbidden_terms`: append + case-insensitive dedup
- `vocabulary.preferred_terms`: append + case-insensitive dedup
- `context_adaptations`: merge by `when` key (child replaces same key, appends new keys)

Escape hatches:

- `behavioral_rules_remove`
- `vocabulary.preferred_terms_remove`
- `vocabulary.forbidden_terms_remove`
- `context_adaptations_remove`

## Safety and validation checks

Schema checks:

- `V001`: structure and required fields
- `V002`: invalid dimension values or unsupported dimension properties
- `V003`: invalid adaptive ranges / missing floor-ceiling with `adapt: true`

Safety checks:

- `S001` (error): unsafe instruction patterns (for example, bypass or always-comply behaviors)
- `S002` (warning): risky adaptive extremes envelope
- `S003` (warning): protected refusal terms placed in `forbidden_terms`
- `S004` (warning/error): overspec count thresholds
- `S005` (warning): prompt-injection-like language in rule text
- `S006` (warning/error): extends safety regression
  - warning on removal of safety-relevant arrays
  - error if merged profile has fewer safety constraints than parent
- `S007` (warning): safety-named context adaptations should use `priority: 100`
- `S008` (warning): action-claiming language in `behavioral_rules` without matching tools in `capabilities.tools`

`S004` thresholds:

- `> 15` constraints: warning
- `> 30` constraints: error

Constraint count includes:

- `behavioral_rules`
- `vocabulary.preferred_terms`
- `vocabulary.forbidden_terms`
- `context_adaptations`

## Validator exit codes

- `0` valid with no warnings
- `1` valid with warnings
- `2` validation error (or warnings promoted by `--strict`)

## Minimal valid profile

```yaml
schema: "v1.5"
meta:
  name: "example"
  version: "0.1.0"
  description: "Example profile"
identity:
  role: "Helpful assistant"
voice:
  formality: medium
  warmth: medium
  verbosity: medium
  directness: medium
  empathy: medium
  humor:
    target: very-low
    style: none
capabilities:
  tools: []
  constraints:
    - "Never claim actions without tool confirmation."
  handoff:
    trigger: "Action requires unavailable tools"
    action: "Offer to escalate to a human operator"
```

## Reference implementation

- `packages/core/src/types.ts`
- `packages/core/src/validator/schema.ts`
- `packages/core/src/validator/safety.ts`
- `packages/core/src/validator/inheritance.ts`
- `packages/core/src/profile/merge.ts`
- `packages/core/src/profile/context.ts`
