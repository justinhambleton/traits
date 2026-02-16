# Schema Reference (v1.6)

This page documents the voice and behavioral policy schema used by `@traits-dev/core`. For validation codes, see [Safety & Validation Codes](/reference/safety-codes).

## Schema version

| Version | Status | Key additions |
|---------|--------|--------------|
| `v1.4` | Supported | Base schema |
| `v1.5` | Supported | `capabilities` section |
| `v1.6` | **Current** | Array `extends`, `locked` rules, object-form behavioral rules |

Any other schema value fails validation ([V001](/reference/safety-codes#v001-structure-errors)). Use `traits migrate` to upgrade older profiles.

## Top-level structure

| Section | Required | Since |
|---------|----------|-------|
| `schema` | Yes | v1.4 |
| `meta` | Yes | v1.4 |
| `identity` | Yes | v1.4 |
| `voice` | Yes | v1.4 |
| `vocabulary` | No | v1.4 |
| `behavioral_rules` | No | v1.4 |
| `context_adaptations` | No | v1.4 |
| `capabilities` | No | v1.5 |
| `extends` | No | v1.4 (array form v1.6) |
| `localization` | No | v1.4 |
| `channel_adaptations` | No | v1.4 |
| `behavioral_rules_remove` | No | v1.4 |
| `context_adaptations_remove` | No | v1.4 |

Unknown top-level keys fail validation ([V001](/reference/safety-codes#v001-structure-errors)).

## `meta`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Profile identifier |
| `version` | `string` | Yes | Semver version |
| `description` | `string` | Yes | Human-readable description |
| `tags` | `string[]` | No | Categorization tags |
| `target_audience` | `string` | No | Intended user audience |

Additional keys are allowed.

## `identity`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `role` | `string` | Yes | What the agent is (e.g., "Customer support specialist") |
| `backstory` | `string` | No | Background context for the agent |
| `expertise_domains` | `string[]` | No | Areas of expertise |

Additional keys are allowed.

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

- Optional array of:
  - `string` (existing)
  - `{ rule: string, locked?: boolean }` (`v1.6`)
- Rules are included in compile output and safety-scanned.
- Locked rules are preserved during `extends` merge and cannot be removed by child profiles.

## `capabilities` (`v1.5+`)

Optional object (valid when `schema: "v1.5"` or `schema: "v1.6"`):

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
- `constraints: Array<string | { rule: string, locked?: boolean }>`
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

`extends` accepts either:

- `extends: "parent-name"` (single parent)
- `extends: ["parent-a", "parent-b", "parent-c"]` (multi-parent chain; `v1.6` only)

Resolution search order for each parent name:

1. Sibling directory of the child profile.
2. Bundled starter profiles (`profiles/` in the SDK package).

For array form, parent profiles are merged left to right before the child is applied:

1. Start with the first parent as base.
2. Merge the second parent on top.
3. Merge each next parent in sequence.
4. Merge the child last.

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

Locked rule behavior (`v1.6`):

- Locked behavioral rules are preserved during merge, even if listed in `behavioral_rules_remove`.
- Attempting to remove a locked inherited behavioral rule triggers `S006` error.

## Safety and validation checks

| Code | Severity | What it checks |
|------|----------|---------------|
| V001 | error | Structure and required fields |
| V002 | error | Invalid dimension values or properties |
| V003 | error | Invalid adaptive ranges (floor/ceiling) |
| S001 | error | Jailbreak/bypass patterns |
| S002 | warning | Unsafe adaptive dimension extremes |
| S003 | warning | Protected refusal terms in forbidden vocabulary |
| S004 | warning/error | Constraint count overspec (>15 warn, >30 error) |
| S005 | warning | System prompt reference patterns |
| S006 | warning/error | Inheritance safety regression |
| S007 | warning | Safety adaptations without priority 100 |
| S008 | warning | Action-claiming language without matching tools |

See [Safety & Validation Codes](/reference/safety-codes) for trigger conditions and fix guidance.

## Validator exit codes

| Code | Meaning |
|------|---------|
| `0` | Valid with no warnings |
| `1` | Valid with warnings |
| `2` | Validation error (or warnings promoted by `--strict`) |

## Minimal valid profile

```yaml
schema: "v1.6"
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

## Related pages

- [Safety & Validation Codes](/reference/safety-codes) — every V and S code with fix guidance
- [Core Concepts](/concepts) — profile anatomy and governance pipeline
- [Extend Profiles Safely](/guides/extending-profiles) — inheritance patterns
- [CLI Reference](/reference/cli) — `validate`, `compile`, `migrate` commands

## Reference implementation

- `packages/core/src/types.ts`
- `packages/core/src/validator/schema.ts`
- `packages/core/src/validator/safety.ts`
- `packages/core/src/validator/inheritance.ts`
- `packages/core/src/profile/merge.ts`
- `packages/core/src/profile/context.ts`
