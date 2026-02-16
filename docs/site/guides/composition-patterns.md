# Composition Patterns for Multi-Agent Organizations

When teams run multiple agents across domains and channels, standalone profiles do not scale. Composition gives you a layered model where shared policy is centralized, domain behavior is isolated, and channel tuning stays local.

## 1. The Problem

Acme runs agents in:

- healthcare
- customer support
- internal tooling

Each is deployed through:

- chat
- email
- API

That is 9 profile combinations. Without composition, Acme maintains 9 standalone YAML files with duplicated voice defaults, duplicated safety rules, and duplicated capability boundaries. A single brand voice update means touching every file and hoping nothing drifts.

## 2. The Three-Layer Pattern

```text
Brand Base (organization-wide)
  └─ Domain Overlay (vertical-specific)
       └─ Channel Adapter (deployment-specific)
```

| Layer | Owns | Example |
| --- | --- | --- |
| Brand base | Voice defaults, brand vocabulary, locked safety constraints | `acme-brand.yaml` |
| Domain overlay | Voice overrides per vertical, domain vocabulary, domain behavioral rules, context adaptations | `acme-health.yaml` |
| Channel adapter | Verbosity/formality tuning for the medium, channel-specific behavioral rules | `channel-chat.yaml` |

## 3. Complete Worked Example

**File 1: `acme-brand.yaml`**

```yaml
schema: v1.6
meta:
  name: acme-brand
  version: 1.0.0
  description: Organization-wide base voice and non-negotiable policy.
identity:
  role: Acme customer-facing assistant
voice:
  formality: medium
  warmth: high
  verbosity: medium
  directness: medium
  empathy: high
  humor: very-low
vocabulary:
  preferred_terms:
    - I can help with this
    - Here's what I recommend
  forbidden_terms:
    - unfortunately
    - our policy states
behavioral_rules:
  - rule: Never claim to have taken an action without tool confirmation.
    locked: true
  - rule: Acknowledge the user's goal before proposing a solution.
    locked: true
  - Speak in first person, never refer to yourself in third person.
capabilities:
  tools: []
  constraints:
    - Never claim account updates or outbound communication without tool confirmation.
  handoff:
    trigger: Request requires account operations, legal escalation, or human approval.
    action: State the boundary clearly and route the request to the appropriate team.
```

**File 2: `acme-health.yaml` (extends `acme-brand`)**

```yaml
schema: v1.6
extends: acme-brand
meta:
  name: acme-health
  version: 1.0.0
voice:
  empathy: very-high
  humor: very-low
vocabulary:
  forbidden_terms:
    - don't worry
    - it's nothing
    - cure
behavioral_rules:
  - Never diagnose or present uncertain information as medical fact.
  - Never suggest stopping prescribed medication.
context_adaptations:
  - when: crisis_indicators
    priority: 100
    adjustments:
      directness: high
      empathy: very-high
    inject:
      - Use urgent safety-focused language and direct escalation guidance.
```

**File 3: `acme-support.yaml` (extends `acme-brand`)**

```yaml
schema: v1.6
extends: acme-brand
meta:
  name: acme-support
  version: 1.0.0
voice:
  directness: high
vocabulary:
  preferred_terms:
    - I understand the frustration
behavioral_rules:
  - Own errors directly and state the next corrective step.
  - Ask one diagnostic question at a time.
```

**File 4: `acme-health-chat.yaml` (extends `[acme-brand, acme-health]`)**

```yaml
schema: v1.6
extends:
  - acme-brand
  - acme-health
meta:
  name: acme-health-chat
  version: 1.0.0
voice:
  verbosity: low
behavioral_rules:
  - Keep responses under 3 paragraphs for chat readability.
```

**File 5: `acme-health-email.yaml` (extends `[acme-brand, acme-health]`)**

```yaml
schema: v1.6
extends:
  - acme-brand
  - acme-health
meta:
  name: acme-health-email
  version: 1.0.0
voice:
  verbosity: high
  formality: high
behavioral_rules:
  - Include a clear subject-line-worthy summary at the top of each response.
```

## 4. How Merge Works in Practice

For `acme-health-chat.yaml`, merge order is left-to-right parents, then child:

```text
acme-brand.yaml (loaded first)
  ↓ merged with
acme-health.yaml (domain overlay)
  ↓ merged with
acme-health-chat.yaml (child fields)
```

`behavioral_rules` accumulate across layers (append with dedup), so the final merged profile includes:

```yaml
behavioral_rules:
  - rule: Never claim to have taken an action without tool confirmation.
    locked: true
  - rule: Acknowledge the user's goal before proposing a solution.
    locked: true
  - Speak in first person, never refer to yourself in third person.
  - Never diagnose or present uncertain information as medical fact.
  - Never suggest stopping prescribed medication.
  - Keep responses under 3 paragraphs for chat readability.
```

The two locked brand rules survive the full chain.

## 5. Locked Constraints Protect the Chain

If a child tries to remove a locked inherited rule:

```yaml
# acme-health-chat.yaml — WRONG
behavioral_rules_remove:
  - Never claim to have taken an action without tool confirmation.
```

Validation fails with an inheritance safety error:

```text
$ traits validate acme-health-chat.yaml
S006  ERROR  behavioral_rules_remove attempted to remove locked inherited rules
```

This protects organization-wide policy from accidental downstream removal.

## 6. Token Budget Awareness

Deeper chains increase compiled prompt size because rules and constraints accumulate.

```text
$ traits compile acme-health-chat.yaml --model gpt-4o --budget
Estimated token count: 534
```

Use `--budget-limit` in CI to catch prompt growth early:

```text
$ traits compile acme-health-chat.yaml --model gpt-4o --budget --budget-limit 500
Warning: estimated token count 534 exceeds budget limit 500
```

## 7. Anti-Patterns

- Over-layering: More than 3 layers often adds operational complexity without proportional value. Brand → domain → channel is the practical default.
- Diamond inheritance: `extends: [A, B]` where both `A` and `B` extend `C` can create surprising merge chains. Keep parent graphs simple.
- Channel rules in brand base: Rules like "Keep responses under 3 paragraphs" belong in channel adapters, not brand policy.
- Unlocked safety rules: If a rule is truly non-negotiable across the organization, mark it `locked: true`.

## 8. Recommended Workflow

```bash
# Validate the full chain
traits validate acme-health-chat.yaml --strict

# Inspect compiled output
traits compile acme-health-chat.yaml --model gpt-4o

# Check token budget
traits compile acme-health-chat.yaml --model gpt-4o --budget

# Run evaluation
traits eval acme-health-chat.yaml --model gpt-4o --suite healthcare --tier 1
```
