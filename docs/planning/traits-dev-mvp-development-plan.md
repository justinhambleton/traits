# traits.dev — MVP Development Plan

## From Architecture to Shipping Code

*February 2026 — This plan translates the architectural specifications from Parts III and IV into a concrete development sequence. It covers the validation experiment, core SDK development, and launch preparation across approximately 12 weeks. Every task traces back to a specific architectural decision.*

> **Status (2026-02-13):** Superseded for implementation by `docs/plans/2026-02-12-feat-traits-dev-mvp-implementation-plan.md` (v1.4, solo delivery scope). Keep this document as historical planning context.

---

## Scope: What Ships in the MVP

The MVP is the Phase 1 build-time SDK described across Parts III and IV. It includes:

- **Schema v1.3**: 5 dimensions, 5 levels, compliance range syntax, adaptation schema (accepted but not compiled), channel_adaptations (reserved), safety constraints
- **Validator**: Schema validation, safety checks (S001-S004), overspecification warnings, extremes envelope analysis for adaptive profiles
- **Compiler**: Constraint-to-pattern translation for 2 model families (Claude, GPT), ~200 calibration points, structured output with placement guidance, safety floor injection, `--explain` flag
- **Eval**: Three-tier (deterministic, embedding-based, LLM judge), baseline comparison, helpfulness dimension, overspecification detection
- **CLI**: `traits init`, `traits validate`, `traits compile`, `traits eval`, `traits suggest`, `traits import`, `traits migrate`, `traits diff`
- **SDK**: `@traits-dev/core` (TypeScript), `injectPersonality` helper
- **Framework adapter**: `@traits-dev/vercel` (Vercel AI SDK middleware)
- **Profiles**: 5 starter profiles in v1.3 schema
- **MCP**: Phase 1 static pre-compiled artifact serving
- **Documentation**: Getting started guide, schema reference, CLI reference, integration guide

### What Does NOT Ship in the MVP

- Adaptive compilation (compiler treats all dimensions as non-adaptive)
- Adaptive eval (paired scenarios, range adherence scoring)
- Runtime drift detection middleware
- Analytics dashboard
- Python SDK
- Locale support beyond en-US
- Channel-specific compilation

---

## Pre-Development: The Validation Experiment (Weeks 1–2)

This experiment runs before compiler development begins. Schema, validator, and CLI scaffolding can be built in parallel.

### Week 1: Setup and Execution

**Days 1–2: Prepare materials**

- Author 3 test profiles in v1.3 schema: `resolve` (customer support), `architect` (developer tooling), `advisor` (professional advisory)
- Hand-compile each profile into the system prompt the compiler would produce, using the knowledge base patterns described in Part I and the compilation examples from Part III Section 4
- Write the 50-scenario eval suite:
  - 15 standard domain-appropriate requests per profile
  - 10 frustrated/adversarial user scenarios
  - 5 edge cases (rule-breaking attempts, ambiguous requests)
  - 5 multi-turn conversations (10+ turns each)
  - 5 formal register scenarios
  - 5 casual register scenarios
  - 5 mixed register scenarios (shifts mid-conversation)
- Build eval harness: script that runs each prompt × each scenario through the target model and collects responses
- Define scoring rubrics for each metric (vocabulary adherence, response structure, formality consistency, warmth/empathy presence, directness, task helpfulness, multi-turn consistency)

**Days 3–5: Recruit participants and collect prompts**

- Recruit Cohort A (10 typical developers): full-stack engineers who have written at least one system prompt
- Recruit Cohort B (5 experienced prompt engineers): developers with 10+ production system prompts
- Distribute the brief (Part IV, Section 1)
- Cohort A: 20 minutes, Cohort B: 30 minutes
- Collect all prompts

### Week 2: Evaluation and Analysis

**Days 1–3: Run eval suite**

- Execute 50 scenarios × (10 + 5 + 3 hand-compiled) prompts × target model
- Run Tier 1 checks (string matching, pattern matching) — automated
- Run Tier 2 checks (embedding similarity to reference clusters) — automated
- Run Tier 3 checks (LLM judge with rubrics) — automated, but spot-check 10% manually
- Total API cost estimate: ~$200-400

**Days 4–5: Analyze results and make decisions**

Produce analysis document covering:

1. **Primary outcome determination**: Which of Outcome A, B, or C? (See Part IV, Section 1)
2. **Cohort A variance**: spread of adherence scores across typical developer prompts
3. **Helpfulness trade-off curve**: personality adherence vs. task helpfulness scatter plot
4. **Per-dimension analysis**: which dimensions the hand-compiled prompts excel at vs. struggle with
5. **Overspecification threshold**: where the adherence-helpfulness curve inflects

**Decision gate**: Based on results, confirm or adjust:

| Decision | Outcome A (quality) | Outcome B (workflow) | Outcome C (assist) |
|---|---|---|---|
| Knowledge base investment | High — depth of patterns is the product | Medium — patterns are sufficient but not the differentiator | Low — pivot to linting/eval |
| Marketing lead | "Expert-level personality" | "Write once, compile everywhere" | "Measure and improve your prompts" |
| `--explain` purpose | Debugging tool | Learning tool | Primary feature |
| Compiler priority | Pattern quality | Multi-model coverage | `traits import` → `traits eval` loop |

**Deliverable**: Experiment report with primary outcome, secondary analysis, and confirmed development priorities. This report determines the emphasis of Weeks 3–12.

---

## Phase 1: Foundation (Weeks 3–5)

Build the schema, validator, CLI scaffolding, and project structure. These components have no dependency on the experiment outcome — they're needed regardless.

### Week 3: Project Setup and Schema Implementation

**Monorepo structure:**

```
traits-dev/
├── packages/
│   ├── core/              # @traits-dev/core — schema, validator, compiler, eval
│   │   ├── src/
│   │   │   ├── schema/    # Schema types, parser, serializer
│   │   │   ├── validator/ # Validation engine, safety checks
│   │   │   ├── compiler/  # Compilation engine, knowledge base, patterns
│   │   │   ├── eval/      # Eval framework, tiers, baselines
│   │   │   ├── inject/    # injectPersonality helper
│   │   │   └── index.ts
│   │   ├── test/
│   │   └── package.json
│   ├── cli/               # traits CLI
│   │   ├── src/
│   │   │   ├── commands/  # init, validate, compile, eval, suggest, import, migrate, diff
│   │   │   └── index.ts
│   │   ├── test/
│   │   └── package.json
│   ├── vercel/            # @traits-dev/vercel — Vercel AI SDK middleware
│   └── mcp/               # MCP server for static artifact serving
├── profiles/              # Starter profile library (v1.3 schema)
├── knowledge-base/        # Compiler patterns (calibrated prompts per dimension/model)
├── docs/                  # Documentation site
└── eval-scenarios/        # Eval scenario library
```

**Tasks:**

- [ ] Initialize monorepo (Turborepo or Nx)
- [ ] Set up TypeScript, ESLint, Vitest, CI pipeline
- [ ] Implement schema types in `@traits-dev/core`

```typescript
// Core schema types (from Parts III and IV)
type Level = 'very-low' | 'low' | 'medium' | 'high' | 'very-high';
type DimensionName = 'formality' | 'warmth' | 'verbosity' | 'directness' | 'empathy';

type DimensionShorthand = Level;
type DimensionObject = {
  target: Level;
  adapt: boolean;
  floor?: Level;   // Required when adapt: true
  ceiling?: Level; // Required when adapt: true
};
type DimensionValue = DimensionShorthand | DimensionObject;

interface PersonalityProfile {
  schema: string;
  meta: ProfileMeta;
  identity: ProfileIdentity;
  voice: Record<DimensionName, DimensionValue>;
  vocabulary?: VocabularyConstraints;
  behavioral_rules?: string[];
  context_adaptations?: ContextAdaptation[];
  localization?: Record<string, LocaleOverride>;
  channel_adaptations?: Record<string, ChannelAdaptation>; // Reserved, ignored in v1
  extends?: string;
}
```

- [ ] Implement YAML parser with schema version detection
- [ ] Implement shorthand ↔ object normalization (shorthand `"high"` → `{ target: "high", adapt: false }`)
- [ ] Write schema type tests (property-based testing for normalization round-trips)

### Week 4: Validator

**Tasks:**

- [ ] Implement core validation engine:
  - Schema structure validation (required fields, valid section names)
  - Dimension value validation (level values in enum)
  - Adaptation range validation (`floor ≤ target ≤ ceiling`)
  - Composition reference resolution (`extends` target exists)

- [ ] Implement safety checks (Part IV, Section 2):
  - **S001**: Unsafe behavioral rule pattern matching (regex against `behavioral_rules` and `context_adaptations.inject`)
  - **S002**: Extremes envelope analysis — compute the most permissive simultaneous configuration, check against combination table
  - **S003**: Protected vocabulary conflict (forbidden terms vs. protected refusal terms)
  - **S004**: Overspecification safety risk (constraint count threshold)

- [ ] Implement overspecification guard (Part IV, Section 5):
  - Constraint counter (behavioral_rules + vocabulary.preferred + vocabulary.forbidden + context_adaptations)
  - Warning at 15+, error at 30+

- [ ] Implement validation output formatting:
  - Structured result object for programmatic use
  - CLI-formatted output with colored pass/warn/error indicators

- [ ] Write validator tests:
  - Valid profile passes all checks
  - Each safety check triggers on its specific condition
  - Edge cases: empty profiles, profiles with only `extends`, profiles with all dimensions adaptive

### Week 5: CLI Scaffolding and `traits init` / `traits validate`

**Tasks:**

- [ ] Set up CLI framework (Commander.js or similar)
- [ ] Implement `traits init`:
  - Interactive profile creation wizard
  - Generates scaffold YAML with comments explaining each section
  - Asks for domain, tone preference, model target
  - Produces valid v1.3 profile

- [ ] Implement `traits validate`:
  - Reads YAML file, runs full validation pipeline
  - Outputs structured results with safety analysis
  - Exit codes: 0 (pass), 1 (warnings), 2 (errors)

- [ ] Implement `traits diff`:
  - Compares two profile versions
  - Shows dimension changes, added/removed constraints, adaptation range changes

- [ ] Write CLI integration tests

---

## Phase 2: Compiler (Weeks 6–8)

The compiler is the product's core value. Development emphasis here is adjusted by the validation experiment results.

### Week 6: Knowledge Base and Pattern Architecture

**Tasks:**

- [ ] Design knowledge base storage format:

```typescript
interface KnowledgeBase {
  patterns: {
    [model: string]: {
      [dimension: string]: {
        [level: string]: {
          pattern: string;          // The prompt text fragment
          adherence: number;        // Measured adherence score (0-1)
          version: string;          // Pattern version
          calibration_date: string; // When last calibrated
        };
      };
    };
  };
  interactions: {
    [model: string]: InteractionPattern[];
  };
  safety_floor: {
    [model: string]: string;  // Model-specific safety floor text
  };
  placement: {
    [model: string]: PlacementGuidance;
  };
}
```

- [ ] Author initial patterns for Claude Sonnet:
  - 5 dimensions × 5 levels = 25 base patterns
  - Estimated 5-8 interaction patterns (from experiment per-dimension analysis)
  - Safety floor text (Part IV, Section 2)
  - Placement guidance (Part IV, Section 3)

- [ ] Author initial patterns for GPT-4o:
  - Same structure, model-specific wording
  - Different placement guidance (personality after tools for GPT)

- [ ] Calibrate patterns:
  - Run each pattern through 20 test scenarios on target model
  - Measure adherence score
  - Iterate patterns that score below 0.75

**Note**: The depth of investment here depends on the validation experiment. If Outcome A (quality), invest heavily in pattern refinement. If Outcome B (workflow), get patterns to "good enough" (>0.75 adherence) and move on.

### Week 7: Compilation Engine

**Tasks:**

- [ ] Implement pattern selection:
  - Given a normalized profile and target model, select the best pattern for each dimension
  - Handle interaction effects (check if naive composition of two patterns underperforms a dedicated interaction pattern)

- [ ] Implement vocabulary injection:
  - Preferred terms compiled to structured instructions
  - Forbidden terms compiled to explicit avoidance instructions

- [ ] Implement behavioral rule compilation:
  - Prose rules compiled to structured behavioral instructions within the personality block

- [ ] Implement safety floor injection (Part IV, Section 2):
  - Model-specific safety floor text appended to every compiled output
  - Cannot be disabled or overridden

- [ ] Implement structured output (Part IV, Section 3):
  - `CompiledPersonality` object with `text`, `placement`, `metadata`
  - Token count calculation
  - JSON serialization for `--json` flag

- [ ] Implement `--explain` compilation trace (Part IV, Section 4):
  - Record pattern selections, adherence scores, interaction effects
  - Record token budget breakdown
  - Record safety floor inclusion
  - Format as structured `CompilationTrace` object and as human-readable CLI output

- [ ] Implement `traits compile` CLI command:
  - `--model` flag (required)
  - `--json` flag for structured output
  - `--explain` flag for compilation trace
  - Default: text output to stdout

### Week 8: `injectPersonality` Helper and Context Adaptations

**Tasks:**

- [ ] Implement `injectPersonality` helper (Part IV, Section 3):
  - System prompt section detection (heuristic markers for tools, guardrails, knowledge, format sections)
  - Model-specific insertion at recommended position
  - Safety floor appended at end
  - Fallback: prepend personality, append safety floor

- [ ] Implement context adaptation compilation:
  - Parse `context_adaptations` from profile
  - Compile conditional adjustments into system prompt instructions
  - Handle range modifications (adjusting floor/ceiling within context)

- [ ] Implement conversation mode detection:
  - Short mode (default): standard compilation
  - Long mode: adds personality anchor reminders for multi-turn stability

- [ ] Implement `traits compile` with context flags:
  - `--context key=value` for passing context variables
  - Context variables resolve `when` conditions in `context_adaptations`

- [ ] Write compiler integration tests:
  - Compile `resolve` for Claude and GPT, verify outputs differ appropriately
  - Verify safety floor present in all outputs
  - Verify `--explain` trace matches compilation decisions
  - Verify `injectPersonality` places personality correctly for each model

---

## Phase 3: Eval Framework (Weeks 9–10)

### Week 9: Tier 1 and Tier 2 Eval

**Tasks:**

- [ ] Implement eval scenario format:

```typescript
interface EvalScenario {
  id: string;
  category: 'standard' | 'frustrated' | 'edge' | 'multi-turn' | 'formal' | 'casual' | 'mixed';
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  expected_behavior?: string;  // For LLM judge rubric
}
```

- [ ] Implement Tier 1 checks (deterministic):
  - Vocabulary adherence: string matching for forbidden/preferred terms
  - Response structure: pattern matching for behavioral rules (e.g., "acknowledge before solve")
  - Basic helpfulness: topic relevance keyword matching, response length appropriateness

- [ ] Implement Tier 2 checks (embedding-based):
  - Formality detection: embedding similarity to formality reference clusters
  - Warmth/empathy detection: embedding similarity to warmth/empathy reference clusters
  - Semantic helpfulness: embedding similarity between response and query topic

- [ ] Build reference clusters for each dimension × level combination:
  - 20-30 reference responses per cluster
  - Clusters calibrated on same models as compiler patterns

- [ ] Implement baseline generation (Part IV, Section 5):
  - Baseline A (no personality): generate responses with "You are a helpful assistant"
  - Baseline B (basic personality): generate responses with one-sentence identity summary
  - Both baselines run the same eval scenarios

- [ ] Implement eval report formatting:
  - Per-dimension scores with deltas against both baselines
  - Aggregate personality adherence and helpfulness scores
  - CLI-formatted table output (Part IV, Section 5 format)

### Week 10: Tier 3 Eval and `traits eval` CLI

**Tasks:**

- [ ] Implement Tier 3 checks (LLM judge):
  - Directness scoring: LLM judge with calibrated rubric
  - Warmth/empathy depth: LLM judge for nuance beyond embedding detection
  - Task helpfulness: LLM judge — "Did this response solve the user's problem?"
  - Multi-turn consistency: adherence delta between early and late turns

- [ ] Implement overspecification detection (Part IV, Section 5):
  - Personality-helpfulness tension alert (adherence > 0.85 AND helpfulness < 0.75)
  - Constraint impact analysis (`--constraint-impact` flag): remove each constraint one at a time, re-eval, report impact

- [ ] Implement `traits eval` CLI command:
  - `--model` flag (required)
  - `--tier` flag (1, 2, or 3 — default: highest available based on tier)
  - `--helpfulness` flag (includes helpfulness checks — on by default)
  - `--baselines` flag (includes baseline comparison — on by default)
  - `--constraint-impact` flag (runs constraint impact analysis)
  - `--scenarios` flag (path to custom eval scenario file)
  - JSON output for programmatic consumption

- [ ] Build default eval scenario library:
  - 30 general-purpose scenarios (applicable to any domain)
  - 20 domain-specific scenarios for each of the 5 starter profiles

- [ ] Write eval integration tests:
  - Known-good profile scores above thresholds on all tiers
  - Known-bad profile (intentionally overspecified) triggers tension alert
  - Baselines produce expected deltas

---

## Phase 4: Remaining CLI, Profiles, and Integration (Weeks 11–12)

### Week 11: `traits suggest`, `traits import`, Starter Profiles

**Tasks:**

- [ ] Implement `traits suggest`:
  - Takes `--domain` and `--audience` flags
  - Generates recommended profile YAML based on domain heuristics
  - Includes cultural context disclaimer (Part IV, Section 7)
  - Suggestions derived from starter profile patterns + domain-specific adjustments

- [ ] Implement `traits import`:
  - Accepts existing system prompt (text file or stdin)
  - Analyzes prompt for personality characteristics using LLM
  - Generates best-fit v1.3 profile YAML
  - Free tier: 3 imports, Pro: unlimited

- [ ] Implement `traits migrate`:
  - Detects schema version in existing profile
  - Migrates from older formats to v1.3
  - Reports changes made

- [ ] Author 5 starter profiles in v1.3 schema:
  1. **`resolve`** — Customer support resolution specialist
     - Already drafted in Part III, Section 9; finalize and validate
  2. **`architect`** — Developer experience / technical support
     - High directness, medium formality, low verbosity, medium warmth, medium empathy
     - Locked: directness, verbosity; Adaptive: formality, warmth, empathy
  3. **`advisor`** — Financial/professional advisory
     - High formality, medium warmth, high verbosity, high directness, medium empathy
     - Locked: formality, directness; Adaptive: warmth, verbosity, empathy
  4. **`guide`** — Healthcare/wellness communication
     - Medium formality, very-high warmth, high verbosity, medium directness, very-high empathy
     - Locked: warmth, empathy; Adaptive: formality, verbosity, directness
  5. **`catalyst`** — Consultative sales
     - Medium formality, high warmth, medium verbosity, medium directness, high empathy
     - Locked: warmth; Adaptive: formality, verbosity, directness, empathy

- [ ] Validate all starter profiles pass safety checks and eval
- [ ] Run eval on all 5 profiles across both model targets, verify adherence > 0.70 on all dimensions

### Week 12: Framework Adapter, MCP, Documentation, Launch Preparation

**Tasks:**

- [ ] Implement `@traits-dev/vercel` middleware:
  - `withPersonality(model, profileName, options)` wrapper
  - Uses `injectPersonality` internally for correct placement
  - Passes context variables from options to compiler
  - Integration tests with Vercel AI SDK

- [ ] Implement MCP server (Phase 1 — static artifacts):
  - Serves pre-compiled personality prompts as MCP resources
  - Profile metadata accessible via MCP tool calls
  - No dynamic compilation (Phase 2)

- [ ] Implement composition operators:
  - `extends`: single inheritance, child overrides parent
  - `compose`: merge multiple profiles with priority order
  - `merge` (restricted): weighted combination with coherence check
  - Composition + safety: re-validate composed result against S001-S004

- [ ] Write documentation:
  - **Getting started**: Install CLI, create first profile, compile, inject into application
  - **Schema reference**: Complete v1.3 schema with all fields, types, constraints, examples
  - **CLI reference**: All commands, flags, output formats
  - **Integration guide**: `injectPersonality`, Vercel AI SDK, manual placement, MCP
  - **Safety guide**: What the safety checks catch, how to resolve warnings
  - **Design guide**: Principles for authoring effective profiles (from Part III, Section 7)

- [ ] Set up traits.dev website:
  - Landing page
  - Documentation site
  - npm package publishing pipeline for `@traits-dev/core`, `@traits-dev/cli`, `@traits-dev/vercel`

- [ ] Set up billing infrastructure:
  - Free tier: 3 profiles, Tier 1+2 eval, extends only, 3 imports, no adaptation
  - Pro tier: unlimited profiles, Tier 3 eval, all composition, adaptive compilation, `--explain`
  - Usage tracking: profile count, import count, eval runs, compilation count

---

## Post-MVP Roadmap (Months 4–6)

These items are explicitly out of scope for the 12-week MVP but should be planned for immediately after launch.

### Month 4: Adaptive Compilation (Phase 1.5)

- Author ~30 adaptive prompt patterns for the knowledge base
- Implement adaptive compilation (compiler reads `adapt/floor/ceiling` and produces range-aware prompts)
- Implement paired scenario eval (casual user vs. formal user for each adaptive dimension)
- Implement range adherence scoring in Tier 2 eval
- Ship `traits eval --adaptive` flag

### Month 5: Python SDK and Additional Model Targets

- Port `@traits-dev/core` to Python (`traits-dev` PyPI package)
- Schema parsing, validation, compilation, `inject_personality`
- Add model targets: Claude Opus, GPT-4-mini, Gemini Pro
- Pattern calibration for new targets

### Month 6: Runtime Middleware (Phase 2 — Team Tier)

- Drift detection middleware (monitor personality adherence during live conversations)
- Adaptive drift vs. adaptation discrimination (uses compliance range metadata)
- Analytics dashboard (adherence trends, drift patterns, model comparison)
- Team tier billing activation

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Validation experiment shows Outcome C (compiler underperforms experts) | Low-Medium | High — requires product repositioning | Pivot to linting/eval product; `traits import` → `traits eval` → manual refinement becomes primary workflow |
| Knowledge base calibration takes longer than expected | Medium | Medium — delays compiler quality | Start with fewer patterns at lower adherence thresholds (>0.70 instead of >0.80), iterate post-launch |
| `injectPersonality` section detection fails on real prompts | Medium | Low-Medium — developers fall back to manual placement | Ship with well-documented manual placement guidance; improve heuristics based on user reports |
| Safety checks produce too many false positives | Medium | Medium — developer frustration | Start with conservative thresholds (only the most dangerous patterns), expand based on real-world profile data |
| Multi-model calibration diverges significantly | Low | Medium — doubles pattern authoring work | Accept some quality variance between models at launch; lead with Claude support, GPT as secondary |
| Free tier too generous — low conversion | Medium | Medium — revenue impact | Conversion trigger is profile count (4th profile), which correlates with genuine scaling need; monitor and adjust |

---

## Success Criteria for MVP Launch

**Technical:**
- All 5 starter profiles pass validation (including safety checks) on both model targets
- Average personality adherence > 0.70 across all dimensions for starter profiles
- Helpfulness score > 0.80 for all starter profiles (personality doesn't degrade task quality)
- Δ vs Basic > 0.10 for all starter profiles (traits.dev adds measurable value over one-line prompts)
- `injectPersonality` correctly places personality for both Claude and GPT prompts
- Safety floor present in 100% of compiled outputs

**Developer experience:**
- Time from `npm install @traits-dev/cli` to first compiled output < 5 minutes
- `traits init` → `traits validate` → `traits compile` → working system prompt in < 10 minutes
- `--explain` trace is readable and actionable for debugging unexpected behavior
- Documentation covers the three most common integration patterns (manual, `injectPersonality`, Vercel middleware)

**Business:**
- 5 starter profiles covering customer support, developer tooling, advisory, healthcare, and sales verticals
- Free tier demonstrates multi-model compilation and Tier 1+2 eval on 3 profiles
- Pro tier upgrade path is clear and triggered by scale needs (4th profile, composition, Tier 3 eval)
