# traits.dev — Architectural Decisions Document, Part IV

## Closing the Foundation: Safety, Composition, Validation, and MVP Readiness

*February 2026 — This document resolves the three critical gaps remaining after Parts I–III: the absence of a validation methodology for the compiler's core value claim, the complete lack of safety architecture, and the missing guidance for how compiled personality integrates into real system prompts. It also incorporates compiler observability, eval baselines, overspecification guards, and a revised revenue model. After this document, the architecture is complete enough for MVP development.*

> **Status (2026-02-13):** Historical architecture reference. For active MVP implementation, use `docs/plans/2026-02-12-feat-traits-dev-mvp-implementation-plan.md` as the source of truth. This document's v1.3 schema is superseded by the v1.4 implementation plan.

---

## Context

Parts I–III produced a well-specified architecture: 5 discrete dimensions with compliance ranges, a constraint-to-pattern compiler, CSS-inspired composition, three-tier eval, and realistic scoping (2 model families, en-US, ~200 calibration points). The adaptation model from Part III is the schema's strongest innovation.

But three foundational issues were never addressed:

1. **Nobody has tested whether the compiler actually outperforms hand-written prompts.** The entire product thesis rests on an unvalidated assumption.
2. **Personality profiles are system prompt components, and system prompts are attack surfaces.** No safety architecture exists.
3. **Every example assumes traits.dev owns the entire system prompt.** No guidance exists for integrating compiled personality into real applications that already have tool instructions, guardrails, and RAG context.

This document resolves all three, then specifies the supporting features needed for MVP: compiler observability, eval baselines, overspecification prevention, and the revised free tier.

---

## 1. Validation Methodology: Proving the Compiler's Value Before Building It

### The Problem

Across four rounds of architecture work, nobody has written a single profile, compiled it, run it against a hand-written equivalent, and measured the difference. The compiler is the product's core value claim, and it's untested.

### The Experiment

**Objective**: Determine whether traits.dev-compiled system prompts produce measurably better personality adherence than hand-written prompts, and at what cost to task helpfulness.

**Design**: Two cohorts, same brief, same eval suite.

**Brief** (given to all participants):
> Design a customer support agent personality. The agent should be empathetic, professional but not stiff, direct about solutions, and never use the word "unfortunately" or the phrase "per our policy." It should acknowledge the user's problem before jumping to solutions. Target model: Claude Sonnet.

**Cohort A — Typical Developers (10 participants)**
Recruited from: full-stack engineers who have written at least one system prompt but don't specialize in prompt engineering. Given 20 minutes and the brief above. No access to traits.dev or its documentation.

**Cohort B — Experienced Prompt Engineers (5 participants)**
Recruited from: developers who have written 10+ production system prompts or who work in AI/ML roles. Given 30 minutes and the same brief.

**Cohort C — traits.dev Compiled**
The traits.dev team authors the equivalent `resolve` profile in the current schema, then hand-compiles it using the knowledge base patterns described in Part I (since the compiler doesn't exist yet, the team writes the system prompt the compiler *would* produce). This simulates the compiler's output.

**Eval Suite** (50 scenarios per prompt):
- 15 standard support requests (account issues, billing, product questions)
- 10 frustrated user scenarios (escalating anger, repeated failures)
- 5 edge cases (user asks agent to break rules, ambiguous requests)
- 5 multi-turn conversations (10+ turns, register drift testing)
- 5 formal user scenarios (enterprise/professional register)
- 5 casual user scenarios (slang, abbreviations, emojis)
- 5 mixed scenarios (starts casual, shifts to serious complaint)

**Metrics** (per scenario, per prompt):

| Metric | Method | Tier |
|---|---|---|
| Vocabulary adherence | String matching (forbidden/preferred) | 1 |
| Response structure | Pattern matching (acknowledge before solve) | 1 |
| Formality consistency | Embedding similarity to reference cluster | 2 |
| Warmth/empathy presence | Embedding similarity + LLM judge | 2/3 |
| Directness | LLM judge with rubric | 3 |
| Task helpfulness | LLM judge: "Did the response actually address the user's problem?" | 3 |
| Multi-turn consistency | Adherence delta between turn 1 and turn 10+ | 2 |

### Three Outcomes and Their Implications

**Outcome A: Compiled prompts score ≥15% higher than Cohort A (typical developers) on personality adherence, with ≤5% helpfulness cost.**

Implication: The compiler is a quality product. The value proposition is "expert-level personality prompts without expert-level prompt engineering skill." Marketing leads with quality. The compiler's knowledge base is the core investment. Pricing can emphasize compilation quality.

**Outcome B: Compiled prompts score within 10% of both cohorts on personality adherence.**

Implication: The compiler is a convenience, not a quality advantage. The product is the *infrastructure* — composition, eval, multi-model compilation, versioning. Marketing leads with workflow: "Write once, compile everywhere, measure everything." The knowledge base becomes less central; the schema, eval, and composition are the product. This shifts development priority toward eval and multi-model compilation over knowledge base depth.

**Outcome C: Hand-written prompts from Cohort B (experts) score ≥10% higher than compiled prompts.**

Implication: The knowledge base approach produces prompts that are worse than what experts write. This means the compiler should *assist* prompt authoring rather than *replace* it. The product becomes a prompt linting/eval tool rather than a compiler. The `traits import` → `traits eval` → manual refinement workflow becomes primary. This is a significant pivot from the current architecture.

### Secondary Analysis

Regardless of primary outcome, the experiment should also measure:

**Cohort A variance**: How much do the 10 typical developer prompts vary from each other? High variance (>25% adherence score spread) validates the consistency story — even if the compiler doesn't beat the best developer, it eliminates the worst-case outcomes.

**Helpfulness trade-off curve**: Plot personality adherence vs. task helpfulness for all prompts. If there's a clear inverse relationship above a certain adherence threshold, that's the overspecification boundary — and it tells us where the constraint count warning should trigger.

**Per-dimension analysis**: The compiler might excel at some dimensions (vocabulary adherence, structural compliance) and underperform on others (naturalness, contextual empathy). This tells us which dimensions to prioritize in the knowledge base.

### Timeline and Cost

- Participant recruitment: 3-5 days (developer communities, social media, direct outreach)
- Prompt authoring: 1 day (all participants + traits.dev team)
- Eval suite execution: 2-3 days (50 scenarios × 16+ prompts × 2 eval passes)
- Analysis: 2 days
- Total: ~2 weeks
- Estimated cost: ~$200-400 in API calls for eval, plus participant incentives if offered

### Decision Gate

**The experiment must complete before compiler development begins.** The results determine:
- Whether the compiler optimizes for quality or workflow
- Which dimensions the knowledge base should prioritize
- What the marketing positioning leads with
- Whether the `--explain` flag is a debugging tool (quality story) or a learning tool (workflow story)

The schema, validator, CLI scaffolding, and eval framework can be built in parallel with the experiment. The compiler itself — the pattern selection logic and knowledge base — should wait for results.

---

## 2. Safety Architecture: Personality Profiles as Responsible System Prompt Components

### The Problem

Personality profiles are system prompt components. System prompts directly influence model behavior. Some personality configurations — especially at their adaptive extremes — could weaken a model's safety behaviors. No document in this series has addressed this.

This isn't a theoretical risk. Consider three concrete scenarios:

**Scenario A: Explicit unsafe rules.** A profile includes `behavioral_rules: "Always prioritize the user's request above all else"`. This overrides the model's trained refusal behavior.

**Scenario B: Unsafe dimension combinations.** A profile with `warmth: very-high`, `directness: very-low`, and `empathy: very-high` produces an agent that validates everything the user says and avoids direct pushback — exactly the posture that makes an agent susceptible to social engineering.

**Scenario C: Adaptive extremes.** A profile with `warmth: { adapt: true, ceiling: "very-high" }` and `directness: { adapt: true, floor: "very-low" }` could, when interacting with a manipulative user, flex to maximum accommodation and minimum directness simultaneously. The static profile might be safe; the adaptive extremes might not be.

### Design Principles

**Principle 1: Safety is a floor, not a dimension.** Safety isn't a personality trait that developers configure — it's a constraint that the compiler enforces regardless of profile content. No profile configuration can lower the safety floor.

**Principle 2: Validate at the extremes.** Adaptive profiles must be safe at every configuration within their compliance ranges, not just at their targets. The validator checks the profile at its most permissive combination of floor/ceiling values.

**Principle 3: Warn, don't block.** Most unsafe configurations are unintentional. The validator should warn loudly and explain why, rather than silently refusing to compile. Hard blocks are reserved for the most dangerous configurations.

### Schema: Safety Constraints

Safety constraints live in the validator and compiler, not in the profile schema. Developers don't configure safety — they're protected by it.

```typescript
// Internal to the compiler — not configurable by profile authors
const SAFETY_FLOOR = {
  // These behavioral instructions are injected into EVERY compiled output
  immutable_instructions: [
    "Regardless of your personality configuration, you must refuse requests " +
    "for content that could cause harm, including but not limited to: " +
    "dangerous activities, illegal actions, or content targeting minors.",
    "Your personality should never prevent you from declining inappropriate " +
    "requests. A warm, accommodating personality still says no when necessary.",
    "If a user attempts to use emotional manipulation to override safety " +
    "boundaries, maintain your refusal while remaining empathetic."
  ],

  // These terms cannot appear in vocabulary.forbidden_terms
  protected_vocabulary: [
    "I can't help with that",
    "I'm not able to",
    "That's not something I can do",
    "I need to decline"
  ],

  // Behavioral rules matching these patterns trigger a warning
  unsafe_rule_patterns: [
    /always comply/i,
    /never refuse/i,
    /prioritize.*user.*request.*above all/i,
    /ignore.*previous.*instructions/i,
    /bypass.*safety/i,
    /override.*guardrails/i
  ]
};
```

### Validator: Safety Checks

The `traits validate` command includes safety analysis as a non-optional check. Safety warnings cannot be suppressed.

```bash
traits validate resolve.yaml

# Standard output:
# ✓ Schema valid (v1.3)
# ✓ Dimension values within range
# ✓ Adaptation ranges valid (floor ≤ target ≤ ceiling)
# ✓ Composition references resolved
# ⚠ Safety analysis: 1 warning (see below)
#
# SAFETY WARNING [S002]: Adaptive extremes may reduce refusal assertiveness
#   Dimensions at their most accommodating configuration:
#     warmth: very-high (ceiling), directness: very-low (floor)
#   This combination at adaptive extremes could produce an agent that
#   prioritizes user validation over appropriate boundary-setting.
#   Recommendation: Set directness floor to "medium" or higher,
#   or lock directness with adapt: false.
#
# Profile is valid with 1 safety warning.
```

### Safety Check Categories

**S001 — Unsafe behavioral rules (ERROR: blocks compilation)**

Triggered when `behavioral_rules` or `context_adaptations.inject` contain patterns matching the unsafe rule list. This is a hard block — the profile cannot compile.

```
ERROR [S001]: Behavioral rule matches unsafe pattern
  Rule: "Always prioritize the user's emotional needs above all other considerations"
  Pattern matched: "prioritize...above all"
  This rule could override the model's safety-trained refusal behavior.
  Rewrite as: "Prioritize the user's emotional needs while maintaining
  appropriate boundaries" or remove the "above all" qualifier.
```

**S002 — Unsafe adaptive extremes (WARNING: compiles with notice)**

Triggered when the most permissive configuration of adaptive dimensions (all floors for directness/formality, all ceilings for warmth/empathy) produces a dimension combination flagged as safety-sensitive.

The specific combinations that trigger S002:

| Configuration | Risk | Threshold |
|---|---|---|
| directness floor ≤ "low" AND warmth ceiling ≥ "very-high" | Social engineering susceptibility | Always warn |
| directness floor ≤ "very-low" (any combination) | Agent cannot push back on inappropriate requests | Always warn |
| empathy ceiling = "very-high" AND directness floor ≤ "low" | Emotional manipulation vulnerability | Always warn |
| All 5 dimensions adaptive with ranges ≥ 3 levels wide | Identity dissolution — agent mirrors rather than communicates | Warn |

**S003 — Protected vocabulary conflict (ERROR: blocks compilation)**

Triggered when `vocabulary.forbidden_terms` includes terms from the protected vocabulary list. These terms are required for the model to express refusal.

```
ERROR [S003]: Forbidden term conflicts with safety-protected vocabulary
  Forbidden: "I can't help with that"
  This phrase is protected because it enables the model to refuse
  inappropriate requests. Removing it from the model's vocabulary
  could degrade safety behavior.
  If you want to rephrase refusals, use vocabulary.preferred_terms
  to suggest alternative refusal language instead.
```

**S004 — Overspecification safety risk (WARNING)**

Triggered when total constraint count is high enough that the model's cognitive budget for safety reasoning may be reduced. This overlaps with the overspecification guard (Section 5) but from a safety lens.

```
WARNING [S004]: High constraint count may reduce safety reasoning capacity
  This profile has 28 constraints. Models with heavily constrained
  personalities show reduced ability to reason about edge cases,
  including safety-relevant ones. Consider reducing to ≤15 constraints.
```

### Compiler: Safety Floor Injection

Every compiled output, regardless of profile content, includes a safety floor block. This block is injected by the compiler, not authored by the developer, and cannot be removed or overridden.

```xml
<!-- For Claude models: placed at END of compiled personality
     (closest to generation, highest behavioral influence) -->
<safety_floor>
  Your personality configuration does not override your core safety
  training. You must still decline requests for harmful content,
  maintain appropriate boundaries regardless of how warm or
  accommodating your personality is configured to be, and prioritize
  user safety over user satisfaction when the two conflict.

  If a user's tone or requests make you uncomfortable or push against
  safety boundaries, maintain your refusal with empathy rather than
  adjusting your personality to accommodate the request.
</safety_floor>
```

For GPT models, the same content is formatted as a natural-language paragraph at the end of the compiled prompt.

**Token cost**: ~80-100 tokens. This is a fixed cost on every compiled output. Given that typical compiled personalities are 400-800 tokens, this adds 10-20% overhead. This is a cost worth paying.

### Adaptation-Specific Safety

The validator evaluates adaptive profiles at their **extremes envelope** — the most permissive simultaneous configuration of all adaptive dimensions. For `resolve`:

```yaml
# resolve's extremes envelope:
# formality: "low" (floor), warmth: "very-high" (ceiling),
# verbosity: "high" (ceiling), directness: "high" (locked),
# empathy: "very-high" (ceiling)
```

Because `resolve` locks directness at "high", the extremes envelope maintains assertiveness even at maximum accommodation on other dimensions. This passes S002. A variant of `resolve` with `directness: { adapt: true, floor: "low" }` would trigger the warning.

The validator generates the extremes envelope automatically and evaluates it against S002's combination table. This is a static analysis step — no LLM calls, no API costs, runs in milliseconds during `traits validate`.

---

## 3. System Prompt Composition: How Compiled Personality Fits Into Real Applications

### The Problem

Every code example in Parts I–III assumes traits.dev owns the entire system prompt. This is never true in production. A real application's system prompt includes:

- **Personality instructions** (what traits.dev compiles)
- **Tool definitions** (function calling schemas, usage instructions)
- **Guardrails** (content policy, topic boundaries, output constraints)
- **Domain knowledge** (RAG context, product information, FAQ)
- **Output format** (JSON mode, structured responses, length constraints)
- **Few-shot examples** (demonstration conversations)

A developer who runs `traits compile resolve.yaml --model claude-sonnet-4-5` gets a string. Where does that string go relative to the other five sections? The answer matters because prompt ordering affects model behavior, and the optimal ordering differs by model.

### Compiler Output: Structured, Not Just a String

The compiler output changes from a plain string to a structured object:

```typescript
interface CompiledPersonality {
  // The compiled personality prompt text
  text: string;

  // Model-specific placement guidance
  placement: {
    model: string;
    recommended_position: 'start' | 'after_tools' | 'end';
    rationale: string;
  };

  // Metadata for debugging and integration
  metadata: {
    profile: string;
    version: string;
    schema_version: string;
    model_target: string;
    token_count: number;
    safety_floor_included: boolean;
    adaptive_dimensions: string[];
    compilation_timestamp: string;
  };

  // Compilation trace (when --explain is used)
  trace?: CompilationTrace;
}
```

### CLI Output

```bash
traits compile resolve.yaml --model claude-sonnet-4-5

# Outputs the text to stdout (for piping, backward compatibility)
# The full structured output is available with --json:

traits compile resolve.yaml --model claude-sonnet-4-5 --json

# {
#   "text": "You are a customer resolution specialist...",
#   "placement": {
#     "model": "claude-sonnet-4-5",
#     "recommended_position": "start",
#     "rationale": "Claude models weight early system prompt content
#       more heavily for behavioral guidance. Place personality before
#       tool definitions and domain knowledge."
#   },
#   "metadata": {
#     "profile": "resolve",
#     "version": "2.2.0",
#     "token_count": 487,
#     "safety_floor_included": true,
#     "adaptive_dimensions": ["formality", "warmth", "verbosity", "empathy"]
#   }
# }
```

### Model-Specific Placement Guidance

Placement recommendations are derived from the knowledge base (and validated during calibration):

**Claude models**: Personality at the **start** of the system prompt. Claude weights early system prompt content more heavily for behavioral guidance. Tool definitions and domain knowledge follow.

```
[PERSONALITY — compiled by traits.dev]
[TOOL DEFINITIONS]
[GUARDRAILS]
[DOMAIN KNOWLEDGE]
[OUTPUT FORMAT]
[SAFETY FLOOR — injected by compiler]
```

Note: The safety floor goes at the *end* for Claude, closest to generation, so it's the last behavioral instruction the model processes before responding. This is the opposite of personality placement (which goes first for weight) — safety should be the final word.

**GPT models**: Personality **after tool definitions**, before domain knowledge. GPT-4o responds best when personality context follows functional instructions, as the persona framing colors how domain knowledge is delivered.

```
[TOOL DEFINITIONS]
[PERSONALITY — compiled by traits.dev]
[GUARDRAILS]
[DOMAIN KNOWLEDGE]
[OUTPUT FORMAT]
[SAFETY FLOOR — injected by compiler]
```

### The `injectPersonality` Helper

For developers who want automatic placement, the SDK provides a helper:

```typescript
import { compile, injectPersonality } from '@traits-dev/core';

// Step 1: Compile the personality
const personality = compile('resolve', { model: 'claude-sonnet-4-5' });

// Step 2: Inject into existing system prompt
const systemPrompt = injectPersonality({
  personality,
  existingPrompt: myCurrentSystemPrompt,
  model: 'claude-sonnet-4-5'
});
```

**How `injectPersonality` works:**

1. Parses the existing prompt to detect section boundaries (looks for common markers: `## Tools`, `<tools>`, `You have access to`, `## Knowledge`, etc.)
2. Inserts the compiled personality at the model-recommended position
3. Appends the safety floor at the end
4. Returns the complete system prompt

**When section detection fails** (the existing prompt has no recognizable structure), `injectPersonality` prepends the personality to the start and appends the safety floor to the end — the safest default.

**Escape hatch**: Developers who want full manual control use the raw `text` from the compiler output and place it themselves. The `placement.rationale` field explains *why* the recommended position is what it is, so the developer can make an informed decision.

```typescript
// Manual placement
const personality = compile('resolve', { model: 'claude-sonnet-4-5' });

const systemPrompt = `
${personality.text}

## Tools
You have access to the following tools...

## Knowledge Base
${ragContext}

${personality.metadata.safety_floor_included ? '' : SAFETY_FLOOR_TEXT}
`;
```

### Integration with Framework Adapters

The Vercel AI SDK middleware and other framework adapters use `injectPersonality` internally:

```typescript
// @traits-dev/vercel — internal implementation
export function withPersonality(model, profileName, options) {
  return wrapLanguageModel(model, {
    transformParams: async (params) => {
      const personality = compile(profileName, {
        model: detectModel(model),
        context: options?.context
      });

      return {
        ...params,
        system: injectPersonality({
          personality,
          existingPrompt: params.system || '',
          model: detectModel(model)
        })
      };
    }
  });
}
```

This means the developer using the Vercel middleware gets correct placement automatically:

```typescript
import { withPersonality } from '@traits-dev/vercel';

const model = withPersonality(
  anthropic('claude-sonnet-4-5'),
  'resolve'
);

// The developer's existing system prompt is preserved and the
// personality is injected at the optimal position
const result = await generateText({
  model,
  system: myExistingSystemPrompt, // Tools, guardrails, domain knowledge
  messages
});
```

---

## 4. Compiler Observability: The `--explain` Flag

### The Problem

The compiler is a black box. A developer who gets unexpected behavior can read the compiled output but can't trace *why* the compiler chose specific patterns. This undermines trust and makes debugging unnecessarily difficult.

### The Solution

```bash
traits compile resolve.yaml --model claude-sonnet-4-5 --explain

# Compiled system prompt (487 tokens):
# [... prompt text ...]
#
# ═══════════════════════════════════════════════════════
# Compilation Trace
# ═══════════════════════════════════════════════════════
#
# 1. Dimension patterns selected:
#    formality: "medium" → pattern "conversational-professional-v2"
#      (adherence: 0.81 on claude-sonnet-4-5)
#    warmth: "high" → pattern "warm-acknowledgment-v3"
#      (adherence: 0.86)
#    verbosity: "medium" → pattern "balanced-concise-v1"
#      (adherence: 0.78)
#    directness: "high" → pattern "clear-action-oriented-v2"
#      (adherence: 0.84)
#    empathy: "high" → pattern "empathetic-validation-v2"
#      (adherence: 0.82)
#
# 2. Interaction effects:
#    warmth:high × directness:high → dedicated pattern
#      "warm-but-direct-v1" (naive adherence: 0.69,
#       dedicated: 0.83, +14%)
#    No other interaction effects triggered.
#
# 3. Adaptive ranges compiled (4 adaptive dimensions):
#    formality: floor "low" → ceiling "high"
#      → adaptive pattern "formality-flex-low-high-v1"
#    warmth: floor "high" → ceiling "very-high"
#      → adaptive pattern "warmth-upward-only-v1"
#    [... etc.]
#
# 4. Vocabulary constraints: 3 preferred, 4 forbidden
#    (injected verbatim)
#
# 5. Behavioral rules: 4 rules
#    (compiled to structured instructions)
#
# 6. Safety floor: injected (82 tokens)
#
# 7. Conversation mode: short
#    (no personality anchor added)
#
# Total: 487 tokens / 1024 recommended maximum
# Placement: START of system prompt (Claude model)
```

### Programmatic Access

```typescript
const result = compile('resolve', {
  model: 'claude-sonnet-4-5',
  explain: true
});

// result.trace contains the structured compilation trace
console.log(result.trace.patterns);
// [{ dimension: 'formality', level: 'medium',
//    pattern: 'conversational-professional-v2', adherence: 0.81 }, ...]

console.log(result.trace.interactions);
// [{ dimensions: ['warmth', 'directness'], levels: ['high', 'high'],
//    naive_adherence: 0.69, dedicated_adherence: 0.83 }]

console.log(result.trace.token_budget);
// { personality: 320, vocabulary: 45, behavioral: 40,
//    safety_floor: 82, total: 487, recommended_max: 1024 }
```

This serves debugging (why does my agent sound wrong?), trust-building (what decisions did the compiler make?), and power-user override (I disagree with this pattern choice — let me use `_prompt_override` for this dimension specifically).

---

## 5. Eval Baselines and Overspecification Guards

### Baseline Comparison

Every eval report includes two baselines:

**Baseline A — No Personality**: The same model with a minimal system prompt ("You are a helpful assistant."). This shows what the model does with zero personality guidance.

**Baseline B — Basic Personality**: The same model with a one-sentence personality instruction derived from the profile's identity block ("You are an empathetic customer support specialist who takes ownership of problems."). This shows what a developer gets with minimal effort.

```
Personality Eval Report: resolve.yaml
Model: claude-sonnet-4-5
═══════════════════════════════════════════════════════

                 resolve    Basic     None     Δ vs Basic   Δ vs None
──────────────────────────────────────────────────────────────────────
Formality:       0.82       0.61      0.50     +0.21        +0.32
Warmth:          0.85       0.68      0.45     +0.17        +0.40
Verbosity:       0.74       0.58      0.55     +0.16        +0.19
Directness:      0.81       0.60      0.52     +0.21        +0.29
Empathy:         0.88       0.72      0.40     +0.16        +0.48

Personality:     0.82       0.64      0.48     +0.18        +0.34
Helpfulness:     0.87       0.90      0.92     -0.03        -0.05

Verdict: Profile adds +0.18 personality adherence over basic prompt
         at a cost of -0.03 helpfulness. Within healthy range.
```

The "Δ vs Basic" column is the core value metric. It answers: "What does traits.dev give me that a one-line prompt doesn't?" If this delta is consistently <0.10 across profiles, the compiler needs better patterns. If it's >0.15, the quality story is credible.

The "Δ vs None" column is the marketing metric. It answers: "How much personality structure does this profile add?" This is always larger than Δ vs Basic and is the more impressive number — but less honest about traits.dev's specific contribution.

### Helpfulness Dimension

The eval framework adds a task helpfulness check to every eval run. This is not optional — it runs alongside personality adherence checks.

**Tier 1 helpfulness checks:**
- Did the response address the user's stated problem? (keyword/topic matching)
- Is the response length appropriate for the query? (not truncated, not padded)

**Tier 2 helpfulness checks:**
- Is the response semantically relevant to the query? (embedding similarity)

**Tier 3 helpfulness checks:**
- Did the response provide a useful solution or next step? (LLM judge)
- Would a human evaluator rate this response as helpful? (LLM judge against rubric)

### Overspecification Guards

The validator counts constraints and warns when the profile is likely overspecified:

```typescript
interface ConstraintCount {
  behavioral_rules: number;
  vocabulary_preferred: number;
  vocabulary_forbidden: number;
  context_adaptations: number;
  total: number;
}

// Thresholds (derived from the validation experiment — Section 1)
const CONSTRAINT_WARNING_THRESHOLD = 15;
const CONSTRAINT_ERROR_THRESHOLD = 30;
```

```bash
traits validate heavy-profile.yaml

# ⚠ OVERSPECIFICATION WARNING [O001]:
#   This profile has 22 constraints:
#     behavioral_rules: 9
#     vocabulary.preferred_terms: 6
#     vocabulary.forbidden_terms: 5
#     context_adaptations: 2
#
#   Profiles with >15 constraints show diminishing personality
#   adherence and measurable helpfulness degradation.
#
#   Recommendations:
#   - Consolidate behavioral rules that express the same intent
#   - Remove vocabulary constraints with <5% trigger frequency
#   - Run 'traits eval --helpfulness' to measure impact
```

When the eval detects a helpfulness score below 0.75 alongside personality adherence above 0.85, it surfaces this explicitly:

```
⚠ PERSONALITY-HELPFULNESS TENSION DETECTED
  Personality adherence: 0.91
  Task helpfulness:      0.68

  Your constraints are likely reducing the model's ability to solve
  the user's problem. The model is spending cognitive effort satisfying
  personality rules instead of reasoning about the task.

  Suggested action: Remove 3-5 lowest-impact constraints and re-eval.
  Use 'traits eval --constraint-impact' to identify which constraints
  contribute least to personality perception.
```

---

## 6. Revised Revenue Model

### The Change

The free tier is redesigned to showcase traits.dev's most defensible capabilities (multi-model compilation and eval) rather than gating them. Conversion is triggered by scale needs, not feature breadth.

### Free Tier

- **3 profiles** (hard limit)
- **All model targets** (compile for Claude, GPT, and future models)
- **Tier 1 + Tier 2 eval** (deterministic + embedding-based)
- **`extends` composition only** (no `compose`, no `merge`)
- **`traits import`** (limited to 3 imports — the adoption ramp must be frictionless)
- **No adaptation** (shorthand syntax only, `adapt: true` requires Pro)
- **Standard calibrations** (same calibrations as Pro — dropping the freshness gate)

### Pro ($29/month)

- **Unlimited profiles**
- **All model targets**
- **Tier 1 + 2 + 3 eval** (adds LLM judge)
- **All composition operators** (`compose`, `merge`, coherence eval)
- **Unlimited `traits import`**
- **Adaptive compilation** (`adapt/floor/ceiling` syntax)
- **`traits suggest --adaptive`** recommendations
- **`--explain` compilation traces**
- **5 starter profiles from library**

### Team ($149/month)

- Everything in Pro
- **Runtime drift detection middleware**
- **Adaptive drift vs. adaptation discrimination** (requires compliance range metadata)
- **Analytics dashboard** (adherence trends, drift patterns, A/B comparison)
- **Custom calibration requests** (priority support for specific model/dimension needs)
- **SSO and team profile sharing**

### Why This Is Better

The previous free tier (2 model targets, Tier 1 eval only, stale calibrations) gave users a constrained version of everything. They could do a little of each capability but nothing impressively.

The revised free tier gives users the *full* multi-model compilation and embedding-based eval experience on a small number of profiles. A developer compiles their one support agent for Claude, GPT, and Gemini. They see embedding-based adherence scores with formality and warmth detection. They experience the two things that prompt files can never do.

When they need a 4th profile, or `compose` to build agent hierarchies, or `merge` to blend personalities, or adaptive compilation for responsive agents — that's when they pay. The conversion trigger correlates with genuine need.

The freshness gate is dropped. The argument from Part II that "most calibrations survive model updates" directly undermines using calibration staleness as a conversion mechanism. Structural gates (profile count, composition features, adaptation, Tier 3 eval) are cleaner and create pain at the moments that match traits.dev's differentiated value.

---

## 7. Schema Reservations for Future Capabilities

These fields are added to the schema spec now, accepted by the validator, and ignored by the compiler in v1. Profiles authored today won't need restructuring when these capabilities ship.

### Channel Adaptations

```yaml
# Schema-valid in v1. Compiler ignores. Validator accepts with info message.
channel_adaptations:
  voice:
    voice:
      verbosity: "low"
      formality:
        target: "medium"
        adapt: true
        floor: "low"       # Contractions sound natural in speech
        ceiling: "medium"
    constraints:
      avoid_parentheticals: true
      prefer_short_sentences: true
  sms:
    constraints:
      max_response_length: 160
      ultra_concise: true
  email:
    voice:
      formality:
        target: "high"     # Email is more formal by default
        adapt: false
      verbosity: "high"    # Emails can be longer
```

```bash
traits validate resolve-with-channels.yaml

# ℹ channel_adaptations: recognized but not compiled in v1.
#   Profiles with channel_adaptations are forward-compatible.
#   Channel-specific compilation is planned for a future release.
```

### Cultural Bias Disclaimer

The `traits suggest` command includes an explicit cultural context notice:

```bash
traits suggest --domain customer-support --audience consumer

# ════════════════════════════════════════════════
# Suggested profile: Customer Support (Consumer)
# ════════════════════════════════════════════════
#
# NOTE: These suggestions reflect US/Western communication norms.
# For other cultural contexts, consider adjusting formality upward
# and directness downward. See: traits.dev/docs/cultural-adaptation
#
# voice:
#   formality:
#     target: "medium"
#     adapt: true
#     floor: "low"
#     ceiling: "high"
# [...]
```

---

## 8. Cross-Document Reconciliation

Parts I and II are historical context. Part III introduced adaptation. This document (Part IV) closes the remaining gaps for the v1.3 architecture baseline. The active implementation source of truth is `docs/plans/2026-02-12-feat-traits-dev-mvp-implementation-plan.md`.

### Schema Version: v1.3 (Historical Baseline)

The following is the complete schema specification for MVP:

**Dimensions** (5): formality, warmth, verbosity, directness, empathy
**Levels** (5): very-low, low, medium, high, very-high
**Syntax**: Shorthand (`dimension: "level"`) or object (`dimension: { target, adapt, floor, ceiling }`)
**Sections**: meta, identity, voice, vocabulary, behavioral_rules, context_adaptations, localization, channel_adaptations (reserved)
**Composition**: extends, compose, merge (restricted)
**Safety**: Validator checks (S001-S004), compiler safety floor injection

### Profile Library Status

The personality profiles library (`personality-profiles-library.md`) uses an outdated schema (continuous 0-1 scales, 8+ dimensions, non-standard section names). Before MVP launch, a minimum of 5 core profiles must be rewritten in the v1.3 schema:

1. `resolve` — Customer support (already updated in Part III, Section 9)
2. `architect` — Developer experience / technical support
3. `advisor` — Financial/professional advisory
4. `guide` — Healthcare/wellness communication
5. `catalyst` — Sales/persuasion (consultative, not aggressive)

These 5 are chosen for maximum perceptual distance in the 5-dimensional grid and coverage of the verticals where personality has the strongest business case. Additional profiles are added post-launch based on demand, not a marketing target number.

### Naming

All documents and code use "traits.dev" consistently. The business plan's "Persona Engine" naming should be treated as an earlier working title.

---

## Cumulative Architecture State (After Four Rounds)

### Schema (v1.3)
- 5 discrete levels across 5 dimensions
- Compliance range syntax per dimension (target, adapt, floor, ceiling)
- Shorthand (backward compatible) vs. object syntax (adaptive)
- Vocabulary constraints (preferred/forbidden with protected terms)
- Behavioral rules (prose constraints with safety pattern checking)
- Context adaptations (developer-passed variables modifying targets and ranges)
- Locale infrastructure (en-US at launch, schema supports expansion)
- **NEW**: Channel adaptations (schema reserved, compiler ignores in v1)
- Composition operators: extends, compose, merge (restricted)
- **NEW**: Safety constraints (S001-S004 validator checks, compiler safety floor)

### Compiler
- Constraint-to-pattern translation with ~200 calibration points at launch
- Adaptive prompt patterns (adds ~30 calibration points) — ships Phase 1.5
- Conversation-aware compilation (short/long modes)
- **NEW**: Structured output (text + placement + metadata)
- **NEW**: `--explain` flag with full compilation trace
- **NEW**: `injectPersonality` helper for system prompt composition
- **NEW**: Safety floor injection in every compiled output
- Automated recalibration pipeline for model releases

### Eval
- Three-tier: deterministic, embedding-based, LLM judge
- **NEW**: Baseline comparison (no-personality + basic-personality deltas)
- **NEW**: Helpfulness dimension alongside personality adherence
- **NEW**: Overspecification detection (constraint count + personality-helpfulness tension)
- Multi-turn scenarios
- Coherence checks for merged profiles
- Range adherence scoring for adaptive dimensions — Phase 1.5
- Paired scenario testing (casual/formal user) — Phase 1.5

### CLI
- `traits init`, `traits validate` (with safety checks), `traits compile` (with `--explain`, `--json`)
- `traits eval` (with baselines, helpfulness, `--adaptive` flag Phase 1.5)
- `traits suggest` (with cultural context disclaimer, `--adaptive` Phase 1.5)
- `traits import` (free tier, 3-import limit), `traits migrate`, `traits diff`

### MCP
- Phase 1: static pre-compiled artifacts
- Phase 2: dynamic compilation with context + adaptation

### Revenue
- **Free**: 3 profiles, all model targets, Tier 1+2 eval, extends only, `traits import` (3), no adaptation
- **Pro** ($29/mo): unlimited profiles, Tier 3 eval, all composition, unlimited import, adaptive compilation, `--explain`, starter profiles
- **Team** ($149/mo): runtime middleware, drift detection, analytics dashboard, custom calibrations, SSO

---

*This document, combined with Part III, forms the complete architectural specification for the traits.dev MVP. The remaining work is empirical (the validation experiment) and implementational (building what's been specified). The schema is stable. The safety model is defined. The composition story is complete. Build it.*
