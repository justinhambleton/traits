# Credibility, Adoption & Hardening Plan

**Date:** 2026-02-15
**Trigger:** External developer feedback on traits.dev v0.1.0 npm package and docs site
**Status:** Approved — ready for implementation

---

## Context

Multiple developers reviewed the published `@traits-dev/core` and `@traits-dev/cli` packages (v0.1.0) and the live docs site at traits.dev. The feedback confirmed the project is worth continuing but identified critical issues that must be addressed before further promotion.

The feedback clusters into three categories:

**Credibility-threatening (fix immediately):**
- The showcase demonstrates ungrounded action claims ("I'll escalate this," "I'll take care of this"). This is the single most damaging thing on the site for the exact audience being targeted.
- "Personality infrastructure" positioning triggers the wrong expectations and invites dismissal.

**Adoption-blocking (fix before promoting):**
- No integration recipes showing where compiled output actually goes in real stacks
- Guide pages 404. API reference is skeletal.
- No capability/grounding model in the schema — the product helps control tone but has no opinion on truthfulness

**Valuable but not urgent:**
- Multi-layer composition (real but can ship later)
- Eval baseline suites and interpretation guidance
- Token budgeting, CI output formats, schema migration tooling

---

## Phase 1: Credibility Triage

Everything here ships before any further promotion of the project.

### 1a. Reposition the language across all surfaces

Replace "personality infrastructure" / "personality profiles" everywhere with "voice and behavioral policy." Surfaces that change:

- Root `package.json` description
- `@traits-dev/core` package.json description and README
- `@traits-dev/cli` package.json description and README
- VitePress site title/description in `config.mts`
- Landing page (`index.md`)
- Schema reference header
- Changeset descriptions
- Product overview doc if it still exists

The word "personality" stays only where it's technically accurate (the `[TRAITS PERSONALITY]` header in compiled output — that's an implementation detail, not marketing). Everywhere user-facing, use "voice profile," "behavioral policy," or "voice governance."

### 1b. Add `capabilities` and `grounding` to the schema as a v1.5 addition

New optional top-level sections:

```yaml
capabilities:
  tools:
    - "account_lookup"
    - "refund_processor"
  constraints:
    - "Never claim to have performed an action without tool confirmation"
    - "Never promise timelines unless explicitly authorized"
  handoff:
    trigger: "Request exceeds defined capabilities"
    action: "Acknowledge limitation, offer to connect with human support"
```

Schema design requirements:

- `capabilities` is optional (profiles without it still validate at v1.5)
- `capabilities.tools` is a string array of tool names the agent has access to
- `capabilities.constraints` is a string array of grounding rules (compiled into output alongside behavioral_rules)
- `capabilities.handoff` has `trigger` and `action` strings
- Validator: new check `S008` — if `capabilities` is present, warn if `behavioral_rules` contain phrases like "I'll take care of" / "I'll escalate" / "I will [action verb]" without a corresponding tool in `capabilities.tools`
- Compiler: emit a `[CAPABILITY BOUNDARIES]` block in compiled output listing tools, constraints, and handoff policy
- Schema version bump: profiles can declare `schema: "v1.5"` — v1.4 profiles remain valid but don't get capability compilation

### 1c. Update all three profiles with capability boundaries

Each profile gets a `capabilities` section that's honest about what the agent can and cannot do in a standalone demonstration context. For the showcase specifically, this means the compiled output will include explicit grounding constraints.

- **Haven:** tools list should reflect what a healthcare companion actually has access to (information lookup, appointment scheduling API, etc. — or empty if it's advisory only). Add constraints like "Never claim to have contacted a care team or made an appointment unless confirmed by tool output."
- **Resolve:** tools list should reflect actual customer service capabilities. Add constraints like "Never claim to have issued a refund, escalated a ticket, or contacted a department unless confirmed by tool output."
- **Architect:** tools list should reflect developer tooling capabilities. This profile is less affected since its responses tend toward advisory/diagnostic rather than action-claiming.

### 1d. Regenerate showcase data with grounding-aware profiles

Run `pnpm showcase:build` against the updated profiles. The compiled system prompts shown in the showcase will now include `[CAPABILITY BOUNDARIES]` blocks, and the regenerated responses should no longer contain ungrounded action claims.

If the regenerated responses still contain ungrounded claims (possible — the LLM may not always comply), add a visible disclaimer to the showcase page: "Responses are voice demonstrations. In production, tool-grounding constraints prevent unsubstantiated action claims."

### Phase 1 acceptance criteria

- [ ] Zero instances of "personality infrastructure" in user-facing text
- [ ] Schema v1.5 with capabilities section passes validation
- [ ] Compiler emits `[CAPABILITY BOUNDARIES]` block when capabilities section present
- [ ] S008 validator check flags ungrounded action language
- [ ] All 3 profiles updated with capabilities sections
- [ ] Showcase regenerated with capability-aware compiled prompts
- [ ] `pnpm test` passes for both packages

---

## Phase 2: Documentation Completeness

The site currently has 4 dead nav links. Fix all of them.

### 2a. "Write Your First Profile" guide

Walk from `traits init` through YAML authoring to `traits validate` to `traits compile`. Start with the minimal valid profile from the schema reference, progressively add voice dimensions, vocabulary, behavioral rules, and now capabilities. End with a compiled output the reader can inspect.

### 2b. Integration recipes page (new, highest-leverage doc page)

This is the page the reviewers are asking for. Create `/guides/integrations` with copy-paste examples for:

- **OpenAI Chat Completions API**: show where `compiled.text` goes in the `system` message
- **Anthropic Messages API**: show where it goes in the `system` parameter
- **Vercel AI SDK**: show the `system` parameter in `generateText` / `streamText`
- **Multi-agent pattern**: show a router that selects a profile by context, compiles it, and injects it before the agent's tool-use loop

Each recipe: 10-15 lines of real, working code. No abstractions. No "see the docs for more." Just the code.

### 2c. "Extend Profiles Safely" guide

Cover single inheritance, merge semantics, safety regression checks (S006), escape hatches for removal. Use a concrete example: brand-base -> domain-health child.

### 2d. "Run Evaluations" guide

Cover Tier 1/2/3, when to use each, how to interpret scores. Include the reviewers' specific concern: "Tier 3 is noisy; don't gate merges solely on it." Be honest about what eval scores mean and don't mean.

### 2e. API reference

Document every public export from `@traits-dev/core` with signature, one-line description, and a usage snippet. Hand-written, not generated.

### Phase 2 acceptance criteria

- [ ] Zero 404s in the site nav
- [ ] Integration recipes page exists with working code for OpenAI, Anthropic, and Vercel AI SDK
- [ ] Evaluation guide includes explicit interpretation guidance and caveats
- [ ] `pnpm docs:build` passes

---

## Phase 3: Eval Hardening

### 3a. Ship baseline scenario suites per profile archetype

Create starter scenario sets that ship with the package:

- **`support` archetype:** 8-10 scenarios covering frustrated users, billing, technical troubleshooting, escalation requests
- **`healthcare` archetype:** 8-10 covering symptom questions, medication concerns, emergency detection, wellness check-ins
- **`developer` archetype:** 8-10 covering debugging, architecture review, code review, incident triage

Users running `traits eval` against a profile that matches an archetype should be able to use these as a starting point rather than writing scenarios from scratch.

### 3b. Add interpretation guidance to eval output

When Tier 3 results are printed, include a note like: "Tier 3 uses LLM judge scoring. Results are directionally useful but noisy. Do not use as a sole merge gate." This should be in the CLI output, not just the docs.

### 3c. CI-friendly output formats

Add `--format json` and `--format junit` flags to `traits eval`. JSON for programmatic consumption, JUnit for CI systems that render test results.

### Phase 3 acceptance criteria

- [ ] At least 3 baseline scenario suites ship in the package
- [ ] `traits eval --format json` and `--format junit` produce valid output
- [ ] Eval CLI output includes interpretation caveats for Tier 2/3

---

## Phase 4: Composition Model

### 4a. Extend `extends` to accept an array

```yaml
extends:
  - brand-base
  - domain-health
  - channel-chat
```

Merge order: left to right (later entries override earlier). Single-string form remains valid (backwards compatible).

### 4b. Add `locked` constraints

Allow any profile to mark specific behavioral rules or safety constraints as non-overridable by children:

```yaml
behavioral_rules:
  - rule: "Never claim actions without tool confirmation"
    locked: true
```

S006 checks should error (not warn) when a child attempts to remove or weaken a locked constraint.

### 4c. Token budgeting

Add `--budget` flag to `traits compile` that reports estimated token count of the compiled output. Warn if the compiled prompt exceeds a configurable threshold (default: 2000 tokens). This prevents profiles from silently consuming most of the context window.

### Phase 4 acceptance criteria

- [ ] `extends` accepts both string and array forms
- [ ] Array merge order is deterministic and documented
- [ ] `locked` constraints block child override with S006 error
- [ ] `traits compile --budget` reports estimated token count
- [ ] All existing tests pass, new tests cover array extends and locked constraints

---

## Phase 5: Schema Migration + Operational Polish

### 5a. Schema migration tooling

`traits migrate` command that upgrades a v1.4 profile to v1.5 (adds empty capabilities section, updates schema version). Future-proofs for v1.5 -> v1.6, etc.

### 5b. SARIF output for CI integration

Add `--format sarif` to `traits validate` for integration with GitHub Code Scanning and similar tools.

### Phase 5 acceptance criteria

- [ ] `traits migrate` upgrades v1.4 -> v1.5 non-destructively
- [ ] `traits validate --format sarif` produces valid SARIF

---

## Sequencing Summary

| Phase | What | Why This Order |
|-------|------|----------------|
| 1 | Credibility triage (positioning + capability honesty + showcase fix) | The site is live and actively misrepresenting the product's safety posture |
| 2 | Documentation completeness (guides + integration recipes + API ref) | 404 pages and missing integration examples block adoption |
| 3 | Eval hardening (baseline suites + interpretation + CI output) | Prevents eval theater, makes the tool useful in real CI pipelines |
| 4 | Composition model (array extends + locked constraints + token budget) | Enables real organizational usage patterns |
| 5 | Migration + polish (schema upgrade tooling + SARIF) | Nice-to-have operational improvements |

**Do not start Phase 2 until Phase 1 is committed and the showcase is regenerated.** The docs should describe the product as it exists after the credibility fixes, not before.

Everything else can overlap where there are no dependencies.

Start with Phase 1. The repositioning (1a) is the quickest win — do it first as a standalone commit, then move into the schema work (1b-1d).
