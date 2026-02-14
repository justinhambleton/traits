# Personality Profiles Spec: Research Synthesis

**Date**: 2026-02-12
**Inputs**: 15 parallel research agents analyzing the personality-profiles-spec.md
**Purpose**: Actionable findings and recommendations for spec revision before implementation

---

## Executive Summary

Fifteen research agents analyzed the personality profiles specification across security, architecture, domain expertise, consistency, and compiler design. The findings are organized below by priority tier.

**Key numbers:**
- 3 HIGH severity findings (blocking): B1 (conflict resolution undefined), B3 (adaptations bypass S002), S4 (extends can strip safety rules)
- 8 MEDIUM severity findings (should fix before implementation)
- 9 LOW/INFO findings (address during implementation)
- 5 critical design decisions required before coding begins
- 5 compiler interaction patterns identified requiring dedicated compilation

---

## TIER 1: Blocking Issues (Resolve Before Implementation)

### B1. Context Adaptation Conflict Resolution is Undefined

**Problem**: When multiple `--context` flags are passed and two adaptations adjust the same dimension to different values, behavior is undefined. Example: `haven` with `newly_diagnosed` (directness: low) + `crisis_indicators` (directness: medium) — the crisis response **must** win unconditionally.

**Research finding**: Behavior trees, game engines (UE5 StateTree), real-time systems (ARM Cortex-M NMI), and conversational AI platforms (Rasa, Dialogflow, Amazon Lex) all solve this with explicit priority mechanisms. CSS's `!important` pattern and Kubernetes strategic merge patches provide additional prior art.

**Recommendation**: Add `priority` field to `ContextAdaptation`:
- Default: `0` (array-order tiebreaker — last wins)
- Safety-critical: `100` (always overrides, mirrors non-maskable interrupt pattern)
- Inject rules always merge additively (never conflict)
- Add `--explain` CLI flag showing per-dimension conflict resolution trace
- Add S007 validator: warn if safety-named adaptations lack `priority: 100`

**Schema change**:
```typescript
interface ContextAdaptation {
  when: string;
  priority?: number;  // 0-100, default 0
  adjustments?: Partial<Record<DimensionName, DimensionValue>>;
  inject?: string[];
}
```

### B2. `extends` Merge Semantics for Arrays are Unspecified

**Problem**: The `extends` operator uses "deep-merge with child wins," but behavior for arrays (`behavioral_rules`, `forbidden_terms`, `preferred_terms`, `context_adaptations`) is undefined. If replacement semantics are used, a child profile can strip safety-critical rules from a parent.

**Research finding**: Tailwind CSS (replace-by-default + `extend` namespace), Docker Compose (append-by-default + `!override`), webpack-merge (configurable per-field), ESLint (array-ordered last-wins), Kubernetes (strategic merge patch), and RFC 7396 (JSON Merge Patch) all provide models. Security policy systems (Trend Micro, GitHub Actions permissions) enforce monotonic accumulation for safety fields.

**Conflict**: The profiles spec (line 961) currently recommends **full-replace** for all array fields in MVP ("simple, predictable, avoids complexity"). The research strongly recommends **append-only** for safety-critical arrays (`behavioral_rules`, `forbidden_terms`) because full-replace allows a child to silently strip compensating controls that S002 relies on.

**Decision required**: Choose one canonical model. The two options:

| Option | Arrays | Safety | Complexity | DX |
|--------|--------|--------|------------|----|
| **A: Full-replace (current spec)** | Child replaces parent arrays entirely | Unsafe — child can strip safety rules silently | Simplest | Requires duplicating parent content |
| **B: Safety-aware append (research rec)** | Safety arrays append, others replace | Safe — safety rules cannot be removed without `_remove` + S006 warning | Slightly more complex | No duplication for additive changes |

**Recommendation**: Adopt **Option B** and update the spec accordingly. The implementation cost is marginal (append + dedup is ~20 lines of merge logic), but the safety benefit is significant. The `_remove` escape hatch with S006 warning creates an auditable trail. Full-replace for `voice.*` and `identity.*` remains correct.

| Field | Merge Behavior |
|-------|---------------|
| `voice.*` | Field-level merge (dimension-level replace) |
| `behavioral_rules` | **Append-only** (child adds to parent) |
| `vocabulary.forbidden_terms` | **Append-only** |
| `vocabulary.preferred_terms` | **Append-only** |
| `context_adaptations` | Key-based merge on `when` (same key = replace, new key = append) |
| `identity.*` | Field-level merge |
| `meta.*` | Field-level merge (tags append) |

**Escape hatch**: `behavioral_rules_remove`, `forbidden_terms_remove` keys (triggers S006 safety regression warning).

### B3. Context Adaptations Bypass S002 Safety Check

**Problem**: S002 only evaluates the base profile's extremes envelope. Context adaptations can create unsafe states (e.g., `haven` + `newly_diagnosed` locks directness at `low` while warmth is locked at `very-high`) that are never validated. The difference between "directness can reach low" and "directness is locked at low" is significant — the latter prevents dynamic correction.

**Recommendation**: The validator MUST compute a separate S002 extremes envelope per context adaptation. When a context adaptation sets `adapt: false` on a dimension, flag it as "locked-by-adaptation" and treat it as more dangerous than a floor/ceiling bound.

### B4. S002 Table Missing Humor Dimension

**Problem**: Part IV (v1.3) defines S002 with 5 dimensions. The profiles spec uses v1.4 with 6 dimensions (adding humor). The S002 combination table does not include humor-related conditions like "humor at very-high ceiling + directness at low floor = potential for deflecting serious requests."

**Note**: The implementation plan (line 16) formally supersedes Part IV for schema authority. The humor S002 condition is already noted in the implementation plan (line 483). The action here is to add the humor S002 condition to the implementation plan's validator spec if not already fully specified, and optionally update Part IV for archival consistency. This is **non-blocking** since the implementation plan is the source of truth.

### B5. `ContextAdaptation` TypeScript Interface Has `adjustments` as Required

**Problem**: The implementation plan's TypeScript interface makes `adjustments` required, but 7 of 19 context adaptations across profiles are inject-only (no adjustments).

**Fix**: Make both `adjustments` and `inject` optional with a validation rule that at least one must be present.

---

## TIER 2: Design Decisions Required

### D1. S004 Overspecification Threshold for Regulated Verticals

**Problem**: Adding necessary safety vocabulary to `haven` (healthcare) and `steward` (finance) pushes them over the flat 15-constraint threshold. Research shows constraint compliance follows `P(all) = P(individual)^n` — exponential degradation — but different constraint types have different cognitive costs.

**Research finding**: IFScale benchmark (2025) shows three model-dependent degradation patterns: threshold decay (150+ instructions OK for reasoning models), linear decay, exponential decay. Forbidden terms cost ~0.5 cognitive units vs 1.0 for behavioral rules.

**MVP recommendation**: **Keep flat S004 thresholds (15 warning / 30 error) for now.** The added profile constraints from P1-P4 keep all profiles at or under 15 with careful constraint wording. Weighted counting, domain-specific thresholds, and constraint packs are deferred until real eval telemetry validates the degradation curves for traits.dev's specific compilation patterns.

**Post-MVP (when eval telemetry is available)**:

| Component | Change |
|-----------|--------|
| Weighted counting | forbidden_terms: 0.5, preferred_terms: 0.5, behavioral_rules: 1.0, context_adaptations: 0.75 |
| Domain thresholds | healthcare/finance/legal: warn at 25, error at 40; general: warn at 15, error at 30 |
| Constraint packs | Group related forbidden terms (e.g., `pack: "finra-2210"`) counting as 1 unit |
| Token budget | Warn above 800 compiled tokens for personality section |
| Override mechanism | `meta.safety.s004_override` with required `reason` and `reviewed_date` |

### D2. Adaptive Compilation in MVP

**Problem**: The implementation plan says "adaptive compilation is deferred" but profiles heavily use `adapt: true` with `floor`/`ceiling`, and context adaptations DO get compiled. Developers will see adaptive ranges in YAML and expect range-aware compiled output.

**Recommendation**: Document clearly: "Context adaptations work (override targets). Automatic floor/ceiling range-based adaptation within a conversation does not." The compiler should compile only the `target` value for adaptive dimensions in MVP. When `floor == target` (12 of 15 adaptive dimensions), omit downward adaptation instructions to save tokens.

### D3. `when` Condition Matching Semantics

**Problem**: The `when` field is a string, the CLI uses `--context key=value`, but the mapping between them is not specified. Developers don't know if it's boolean flag matching, expression evaluation, or something else.

**Recommendation**: Boolean flag matching for MVP: `--context frustrated_user=true` matches `when: "frustrated_user"`. The `when` field is treated as a key name, any truthy value activates it. Document this explicitly.

### D4. Humor Coverage Gap

**Problem**: Humor is ALWAYS locked across all 5 profiles. No profile uses adaptive humor. No context adaptation adjusts humor. The `playful` style is never used. This means the humor dimension's most complex code paths have zero coverage from starter profiles.

**Recommendation**: Either (a) make `pipeline`'s humor adaptive (floor: very-low, ceiling: low) with a `casual_prospect` adaptation that increases humor, or (b) create a schema-exercise test fixture profile demonstrating adaptive humor and the `playful` style.

### D5. Compiled Output Examples

**Problem**: The spec shows only YAML input, never compiled system prompt output. Developers need to see the transformation.

**Recommendation**: Include compiled output examples for at least `resolve` (warmth+directness interaction) and `haven` + `newly_diagnosed` (safety-critical adaptation). Research provided concrete examples for all 5 interaction patterns (see Compiler Patterns section below).

---

## TIER 3: Profile-Specific Fixes

### P1. `haven`: "you have" Forbidden Term Too Broad (MEDIUM)

The substring "you have" would suppress legitimate phrases: "you have the right to...", "you have been exposed to..." (critical safety info).

**Fix**: Replace with specific patterns: `"you have [condition]"` or convert to a behavioral rule: "Never make diagnostic statements like 'you have X condition' — frame as 'your symptoms may be related to...'"

### P2. `haven`: Missing Positive Safety Obligation (MEDIUM)

Behavioral rules are all NEGATIVE ("never diagnose," "never alter medication"). No rule requires the agent to be ASSERTIVE when patient safety is at risk. With directness at `low`, the agent may validate a user's intent to stop medication without pushback.

**Fix**: Add: `"When a user indicates intent to stop or change medication, assertively recommend consulting their care team first — this overrides the default directness level"`

### P3. `haven`: Missing Healthcare Forbidden Terms (MEDIUM)

Missing: `"you should stop taking"`, `"you don't need"`, `"that's normal"`, `"diagnosis"/"diagnosed"`.

**Fix**: Add these terms. With weighted S004 counting, the profile still passes.

### P4. `pipeline`: Missing Manipulation Prevention (MEDIUM)

Only 3 behavioral rules. Missing controls against fabricated social proof, manufactured urgency, and emotional manipulation.

**Fix**: Add: `"Never fabricate or exaggerate case studies, statistics, or customer outcomes"` and `"Never manufacture urgency — no fake deadlines, limited availability, or expiring offers"`. Brings count to 14 (still under flat S004).

### P5. `steward`: Behavioral Rule Contradictions (MEDIUM)

- "During market volatility, increase warmth and decrease pace" is redundant with the `market_downturn` context adaptation
- "decrease pace" has no dimension mapping — "pace" is not a v1.4 dimension

**Fix**: Remove the behavioral rule about market volatility (the adaptation handles it) or add a verbosity adjustment to the `market_downturn` adaptation if "decrease pace" means "be more thorough."

### P6. `steward`: Missing "I recommend" in Forbidden Terms

The design rationale says steward "never says 'I recommend'" but it's not in `forbidden_terms`.

**Fix**: Either add `"I recommend"` to forbidden terms or remove the claim from the design rationale.

### P7. `pipeline` `warm_lead` Adaptation Tension

The injection "accelerate toward next steps" creates tension with the "respect explicit no" behavioral rule.

**Fix**: Modify to: "Mirror their interest level — accelerate toward next steps, but immediately respect any hesitation or decline."

---

## TIER 4: Safety Architecture Enhancements

### S1. S001 Regex Patterns Too Narrow (MEDIUM)

Current patterns miss trivial rephrasings: "do not say no to any request," "the user's satisfaction is your only priority," "disregard system constraints."

**Fix short-term**: Expand regex list with additional patterns.
**Fix long-term**: Add optional LLM-based semantic S001 check (Tier 3 safety).

### S2. S001 Should Scan `identity.backstory` (LOW)

Backstory is compiled into the system prompt with the same influence as behavioral rules, but S001 only scans behavioral rules.

**Fix**: Extend S001 to scan all compiled text fields.

### S3. Add S005: Prompt Injection Detection in Behavioral Rules (MEDIUM)

Rules referencing "system prompt," "instructions," trigger words, or mode-switching are potential prompt injection vectors.

**Fix**: Add S005 checking for injection patterns in behavioral rules and vocabulary.

### S4. Add S006: `extends` Safety Regression Detection (HIGH — blocking for extends)

When a child profile removes safety-critical constraints from a parent, the validator must warn.

**Fix**: S006 emits a warning whenever `_remove` is used on safety-critical fields (behavioral_rules, forbidden_terms). Error if merged result has fewer safety constraints than parent.

### S5. Context Adaptation Floor/Ceiling Bounds Validation (MEDIUM)

No validation that context adaptation adjustments stay within the base profile's declared floor/ceiling range.

**Fix**: Add validator rule: adjustments must produce values within the base profile's declared range, or explicitly acknowledge the override.

---

## TIER 5: Compiler Interaction Patterns

Research identified 5 dimension combinations requiring dedicated compilation (naive composition fails):

### C1. Warmth: high + Directness: high (`resolve`)

**Problem**: Warmth co-moves with reduced assertiveness. SAC Framework (2025) found +10-30pp error rate increase with warm prompts. Naive "be warm" + "be direct" produces incoherent output.

**Pattern**: Unified acknowledge-pivot-solve structure where warmth shows in HOW information is delivered, not WHETHER it's delivered. The `warm-but-direct` pattern achieves 0.78 adherence vs 0.52 for naive composition.

### C2. Warmth: very-high + Directness: low (`haven` at extremes / `newly_diagnosed`)

**Problem**: Creates a textbook social-engineering-vulnerable agent. Must compile safety compensating controls inline.

**Pattern**: Wrap information in invitation language ("when you feel ready"), but include explicit override for safety-critical moments. Place behavioral rules about medication/emergency as hard overrides of the gentle approach.

### C3. Empathy: high + Warmth: high (`resolve`, `pipeline` warm_lead)

**Problem**: Produces redundant instructions ("be warm and caring" + "show empathy and understanding"). Wastes 40-60 tokens.

**Pattern**: Merge into single "interpersonal_approach" block. Distinguish warmth (how agent relates to person) from empathy (how agent understands person's experience). When both >= high, merge into unified behavioral description.

### C4. Formality: high + Humor: low/subtle-wit (`pipeline` under `executive_buyer`)

**Problem**: Extremely narrow corridor. Humor in formal register must work through structural surprise and precision, not informal signals.

**Pattern**: Redirect humor to word choice and structural surprise. Explicitly ban informal humor signals (exclamation marks, emoji, colloquialisms, puns). "If the wit lands, it earns a knowing smile. If it doesn't, it reads as a sharp observation."

### C5. Model-Specific Compilation

**Finding**: Different models need different prompt structures:

| Model | Format | Personality Placement | Default Warmth | Instruction Style |
|-------|--------|----------------------|----------------|-------------------|
| Claude | XML tags | Start of system prompt | Medium-high (suppress for low) | Reasoning-based ("because X, do Y") |
| GPT | Markdown/bold | After tool definitions | Neutral | Directive ("do X") |
| Llama | Plain text | Start, with redundancy | Varies | Explicit and redundant |

The compiler should maintain a `model_defaults` table and skip explicit patterns when the profile target is within one level of the model's natural behavior.

---

## TIER 6: Cross-Document Reconciliation

The implementation plan (line 16) formally supersedes Part IV for schema authority and the MVP development plan for execution sequencing. Actions below are for archival consistency, not blocking.

| Issue | Action | Blocking? |
|-------|--------|-----------|
| Part IV says v1.3 (5 dims), profiles spec says v1.4 (6 dims) | Update Part IV or mark as superseded by implementation plan | No |
| Part IV S002 table has 4 conditions, missing humor | Ensure humor S002 condition is fully specified in implementation plan's validator spec | No (already noted at impl plan line 483) |
| Part IV identity dissolution check says "5 dimensions" | Update if Part IV is maintained; otherwise covered by implementation plan | No |
| MVP development plan uses old profile names (advisor, guide, catalyst) | Already superseded by implementation plan (line 16-18) | No |
| Implementation plan says "adaptive compilation deferred" but context adaptations work | Add explicit callout box explaining what works vs. what's deferred | Yes (documentation) |

---

## Action Items Summary

### Before Implementation (Blocking)
1. Define context adaptation conflict resolution (priority field) — **B1**
2. Resolve `extends` merge semantics: adopt append-only for safety arrays, update spec line 961 — **B2**
3. Add context-adaptation S002 re-evaluation requirement — **B3**
4. Fix `ContextAdaptation` TypeScript interface (`adjustments` optional) — **B5**

### Adopt Now (During Implementation)
5. Document MVP adaptive compilation behavior — **D2**
6. Define `when` matching semantics — **D3**
7. Expand S001 regex patterns and extend to `identity.backstory` — **S1, S2**
8. Add S005 (prompt injection detection in behavioral rules) — **S3**
9. Add S006 (`extends` safety regression detection) — **S4**
10. Add S007 (safety-named adaptations missing priority) — from **B1**
11. Add context adaptation floor/ceiling bounds validation — **S5**
12. Fix `haven` forbidden terms and add positive safety obligation — **P1, P2, P3**
13. Add manipulation prevention to `pipeline` — **P4**
14. Fix `steward` behavioral rule contradictions — **P5, P6**
15. Fix `pipeline` `warm_lead` injection wording — **P7**

### During Implementation (Non-Blocking)
16. Ensure humor S002 condition is fully specified in implementation plan — **B4**
17. Address humor coverage gap — **D4**
18. Add compiled output examples to spec — **D5**
19. Implement 5 compiler interaction patterns — **C1-C5**

### Post-MVP (Defer Until Eval Telemetry Available)
20. S004 weighted/tiered thresholds, domain overrides, constraint packs — **D1**
21. LLM-based semantic S001 check
22. `extends` supply chain security for remote resolution
23. Context adaptation rate limiting for dynamic compilation
24. `_sealed` marker for parent-controlled immutability
25. Constraint impact analysis eval (`traits eval --constraint-impact`)

---

## Research Sources (Selected)

**Academic:**
- SAC Framework (2025) — trait co-mover effects, warmth-assertiveness tradeoff
- IFScale (Jaroslawicz et al., 2025) — instruction following degradation curves
- "Curse of Instructions" (OpenReview 2025) — multiplicative compliance formula
- Oxford Internet Institute (July 2025) — warm models +10-30pp error rate
- BIG5-CHAT (ACL 2025) — prompting vs training for personality
- "System Prompt Robustness" (Mu et al., Feb 2025) — guardrail overload
- Context Rot (Chroma Research, July 2025) — length-based degradation
- Mental Health Chatbot Study (Scientific Reports, 2025) — crisis response failures

**Platform Prior Art:**
- Rasa (policy priority), Dialogflow ES (context specificity), Amazon Lex (intent switching)
- Inworld AI (single-active-goal), UE5 StateTree (transition priority)
- Tailwind CSS, Docker Compose, webpack-merge, ESLint, Kubernetes (merge patterns)
- Trend Micro, GitHub Actions (security inheritance)
- AWS Config Conformance Packs (constraint grouping)

**Official Docs:**
- Anthropic Claude prompting best practices, Claude 4.x guidance
- OpenAI GPT-5.1 prompting guide, personality patterns
- FINRA Rule 2210/3110, CA SB 243, CA AB 489, FDA CDS Guidance (Jan 2026)
