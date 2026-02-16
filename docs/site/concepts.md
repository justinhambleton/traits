# Core Concepts

## The problem with ad-hoc system prompts

Most teams manage agent behavior through raw system prompt strings — pasted into code, duplicated across services, edited by hand. This creates three problems:

1. **No structure.** A 500-word prompt blob has no schema, no validation, no way to diff behavioral changes.
2. **No composition.** When you run 10 agents, each prompt is independent. There is no way to enforce fleet-wide rules or inherit shared policy.
3. **No evaluation.** You cannot measure whether a response actually follows the policy you wrote.

traits.dev replaces ad-hoc prompts with a governance pipeline: define policy as structured YAML, validate safety at build time, compile model-aware system prompts, and evaluate adherence at runtime.

## Profile anatomy

A profile is a YAML file with five sections:

```yaml
schema: v1.6

meta:
  name: my-agent
  version: 1.0.0
  description: Customer support agent with ownership-first framing

identity:
  role: Customer support specialist
  expertise_domains:
    - billing
    - account management

voice:
  directness: high
  warmth: high
  formality: medium
  empathy: high
  verbosity: medium
  humor:
    target: low
    style: none

vocabulary:
  preferred_terms:
    - "I'll take care of this"
    - "Let me look into that"
  forbidden_terms:
    - "unfortunately"
    - "per our policy"

behavioral_rules:
  - Never blame the customer
  - Always provide a next step
  - rule: Do not offer refunds above $500 without escalation
    locked: true

capabilities:
  tools:
    - name: lookup_order
      description: Retrieve order details by ID
  constraints:
    - Only claim actions backed by tool output
```

**meta** — name, version, description, tags. Used for identification and fleet management.

**identity** — role definition and expertise domains. Tells the model who it is and what it knows about.

**voice** — six dimensions (directness, warmth, formality, empathy, verbosity, humor) each set to a level from `very-low` to `very-high`. Controls how the agent communicates.

**vocabulary** — preferred terms the agent should use and forbidden terms it must avoid.

**behavioral_rules** — explicit policy constraints. Rules can be `locked: true` to prevent child profiles from removing them via inheritance.

**capabilities** — tool definitions, constraints, and handoff configuration. Grounds the agent's action claims in actual tool availability.

## The governance pipeline

```
Define → Validate → Compile → Inject → Evaluate
```

### Define

Write a profile in YAML or scaffold one from a starter template:

```bash
traits init my-agent.yaml --template resolve
```

### Validate

Run schema and safety checks at build time:

```bash
traits validate my-agent.yaml --strict
```

Validation catches structural errors (V001–V003) and safety violations (S001–S008) before your prompt reaches a model. See [Safety & Validation Codes](/reference/safety-codes) for the full list.

### Compile

Compile the profile into a model-specific system prompt:

```bash
traits compile my-agent.yaml --model gpt-4o
```

The compiler selects dimension-specific language patterns calibrated for the target model, applies context adaptations, and adds a safety floor. The output is a plain string ready to inject as a system prompt.

### Inject

Place the compiled text into your LLM call:

```js
const compiled = compileProfile("my-agent.yaml", { model: "gpt-4o" });
const response = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [
    { role: "system", content: compiled.text },
    { role: "user", content: userMessage }
  ]
});
```

### Evaluate

Score agent responses against the profile policy:

```bash
traits eval my-agent.yaml --model gpt-4o --response "I'll look into this right now."
```

See [Running Evaluations](/guides/running-evaluations) for tier semantics and CI integration.

## Model-aware compilation

Different model families respond differently to the same prompt language. The compiler maintains calibrated pattern sets per model:

| Aspect | Claude | GPT | Generic |
|--------|--------|-----|---------|
| Prompt placement | Start of system prompt | After tool definitions | End of system prompt |
| Safety floor format | `<safety_floor>` XML tags | `[SAFETY FLOOR]` block | `[SAFETY FLOOR]` block |
| Dimension patterns | Calibrated for Claude instruction-following | Calibrated for GPT directive style | Neutral fallback |

Each dimension × level combination has a model-specific pattern string and an empirical adherence score from offline calibration runs. The compiler selects the pattern matching the profile's target level for each dimension.

Interaction patterns handle dimension conflicts — for example, `warmth: high` + `directness: high` gets a specific pattern that tells the model to "acknowledge first and pivot immediately to action."

## Composition as fleet governance

When you run multiple agents, composition prevents policy drift. traits.dev uses a three-layer pattern:

```
Layer 1: Organization base profile
  └─ Layer 2: Domain profiles (support, healthcare, engineering)
       └─ Layer 3: Individual agent profiles
```

Child profiles inherit from parents via `extends`:

```yaml
schema: v1.6
extends:
  - resolve

meta:
  name: billing-specialist
  version: 1.0.0

voice:
  formality: high    # Override parent's medium formality

behavioral_rules:
  - Never discuss competitor pricing
```

**Merge rules:**
- Voice dimensions: child replaces parent at the dimension level
- Vocabulary: union with deduplication
- Behavioral rules: union with deduplication; `locked: true` rules cannot be removed by children
- Context adaptations: child replaces parent by `when` key, appends if new
- Capabilities: deep merge of tools and constraints

See [Extend Profiles Safely](/guides/extending-profiles) and [Composition Patterns](/guides/composition-patterns) for details.

## Safety model

Validation enforces safety at build time through two categories of checks:

**Schema validation (V001–V003):** Structural correctness — required fields, valid dimension levels, adaptation range constraints.

**Safety checks (S001–S008):**

| Code | What it catches |
|------|----------------|
| S001 | Jailbreak/bypass patterns ("always comply", "ignore previous instructions") |
| S002 | Unsafe adaptive dimension extremes |
| S003 | Protected refusal phrases in forbidden terms |
| S004 | Constraint count overspec (> 15 warning, > 30 error) |
| S005 | System prompt reference patterns |
| S006 | Inheritance safety violations (removing locked rules) |
| S007 | Safety adaptations without maximum priority |
| S008 | Action-claiming language without matching tool capabilities |

Run with `--strict` to promote warnings to errors. See [Safety & Validation Codes](/reference/safety-codes) for the complete reference.

## Evaluation tiers

Three tiers trade speed for fidelity:

**Tier 1** — deterministic, local, < 10 ms. Checks preferred/forbidden term coverage, dimension alignment via signal detection, and helpfulness. Use as a CI gate on every pull request.

**Tier 2** — embedding similarity against reference patterns. Requires an OpenAI API key. Provides directional style signal. Run on release candidates.

**Tier 3** — LLM judge scoring against an adherence rubric derived from the profile. Requires OpenAI or Anthropic API key. Highest fidelity but non-deterministic. Run periodically for quality monitoring.

See [Running Evaluations](/guides/running-evaluations) for scoring formulas and CI recommendations.
