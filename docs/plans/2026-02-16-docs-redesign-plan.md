# Documentation Redesign Plan

**Date:** 2026-02-16
**Scope:** Information architecture, content strategy, visual design system
**Current state:** 10 pages, generic VitePress styling, single-agent voice-tool positioning
**Target state:** 18 pages, academic/technical visual identity, multi-agent governance positioning

---

## Part 1: Visual Design System

### Design Direction

**Academic. Technical. No softness.**

The current site uses startup-SaaS aesthetics: rounded corners everywhere (`border-radius: 0.75rem`–`1rem`), gradient backgrounds, pill buttons, fade-in animations, and soft color washes. This must be replaced with a design language that communicates engineering rigor and governance infrastructure.

**Visual references:** Edward Tufte data presentations, LaTeX academic papers, Stripe's API reference, Linear's changelog.

### Design Tokens

```
Radius:        0                    (zero everywhere — no rounded corners)
Grid:          8px baseline         (all spacing multiples of 8)
Border:        1px solid            (visible, structural — not decorative)
Typography:    JetBrains Mono headings, Inter body (keep current fonts)
Color:         Near-black ink, white surface, single accent (#2563eb)
Backgrounds:   Flat solid — no gradients
Animation:     None — no fade-ins, no pulse, no translateY
Shadow:        None — use borders for separation
```

### Specific CSS Overhaul

**Global resets (custom.css):**
- Set `--vp-border-radius` overrides to `0` at `:root`
- Override all VitePress default radii to `0`
- Add visible grid lines on major containers using `border-bottom: 1px solid var(--border)`
- Enforce 8px spacing grid via consistent `padding`/`margin`/`gap` values

**LandingPage.vue overhaul:**
- `border-radius: 0` on every element (`.step-card`, `.profile-card`, `.visual-card`, `.install-command`, `.playground-link`, `.integration-tabs button`, `.badge`, `.bar-track`, `.bar-fill`, `.scenario-button`, `.prompt-quote`, `.response-score`)
- Remove `radial-gradient` and `linear-gradient` backgrounds — flat solid colors only
- Remove `@keyframes pulse` and `@keyframes fadeInUp` — no animation
- Remove `border-radius: 999px` pill shapes — square badges and buttons
- Replace `color-mix` gradient card headers with flat accent-tinted backgrounds
- Tighten `.section` padding to strict 8px multiples: `padding-top: 64px` (was `5.2rem`)
- Grid lines: add `border-bottom: 1px solid var(--border)` between all major sections
- Button style: square, 1px border, no hover transform

**PlaygroundPage.vue overhaul:**
- Same radius-to-zero treatment on all panels, tabs, sliders, buttons
- Grid-aligned spacing throughout
- No gradient backgrounds on panels

**ShowcasePage.vue overhaul:**
- Same treatment (if kept — may be removed)

**VitePress theme pages (markdown content):**
- Override `.vp-doc` container styles for zero-radius code blocks
- Square-cornered tables with visible grid lines (full cell borders)
- Tight line-height and paragraph spacing

### Color Palette

```
Light mode:
  --surface:    #ffffff
  --surface-2:  #f8f9fa
  --ink:        #0a0a0a
  --muted:      #6b7280
  --border:     #d1d5db
  --accent:     #2563eb
  --accent-bg:  #eff6ff

Dark mode:
  --surface:    #0a0f1a
  --surface-2:  #111827
  --ink:        #e5e7eb
  --muted:      #9ca3af
  --border:     #374151
  --accent:     #60a5fa
  --accent-bg:  #1e3a5f
```

No gradients. No color-mix. Flat solids only.

---

## Part 2: Information Architecture

### New Nav (Top Bar)

```
traits.dev | Quickstart | Guides | Reference | Playground | GitHub
```

Changes:
- "Overview" removed (brand link serves this)
- "Quickstart" added as top-level (most important onramp)
- "Schema Reference" and "API" consolidated under "Reference"

### New Sidebar

```
Getting Started
  Quickstart                                    [NEW]
  Core Concepts                                 [NEW]

Guides
  Write Your First Profile                      [REVISED - v1.6, complete example]
  Extend Profiles Safely                        [REVISED - v1.6 array extends example]
  Composition Patterns                          [EXISTING - promoted]
  Integration Recipes                           [REVISED - tool calling, injectPersonality]
  Run Evaluations                               [REVISED - major expansion]
  CI/CD Pipeline Setup                          [NEW]

Reference
  Schema Reference (v1.6)                       [REVISED - parameter tables]
  CLI Reference                                 [NEW]
  SDK API Reference                             [REVISED - examples, parameter tables]
  Eval Scoring Reference                        [NEW]
  Safety & Validation Codes                     [NEW]
```

### Page Count

| Category | Current | Proposed |
|----------|---------|----------|
| Getting Started | 1 (index) | 2 (quickstart, concepts) |
| Guides | 5 | 7 (+CI/CD, eval expansion) |
| Reference | 2 (schema, api) | 5 (+CLI, eval scoring, safety codes) |
| Interactive | 1 (playground) | 1 |
| **Total** | **9** (excluding showcase) | **15** |

---

## Part 3: Content Strategy

### P0 — Repositioning (Do First)

#### 1. Homepage Messaging Rewrite

**Current hero:**
```
Eyebrow:  "Voice and Behavioral Policy for Agents"
Headline: "Your AI agents sound generic. Fix that."
Subhead:  "Define voice and behavioral policy as YAML..."
CTA:      [npm i @traits-dev/core] [Try the Playground]
```

**New hero:**
```
Eyebrow:  "Governance SDK for AI Agent Behavior"
Headline: "Ship agents with policy, not prompt strings."
Subhead:  "Define voice and behavioral policy as composable YAML profiles.
           Validate safety at build time. Compile model-aware system prompts.
           Evaluate adherence across your agent fleet."
CTA:      [npm i @traits-dev/core] [Quickstart →]
```

**New workflow section:** "Define. Validate. Compile. Evaluate." (add 4th card for eval)

**New section between workflow and profiles:** "Why governance, not just prompting"
Three cards: Composable Policy | Build-Time Safety | Fleet Evaluation

**Profile card title changes:**
- "Built-in profile starters" → "Starter policy profiles"
- Descriptions emphasize constraints and rules, not personality

**Footer CTA:** "Govern agent behavior across your fleet. Start in 90 seconds."

#### 2. Quickstart Page (90 Seconds)

**File:** `docs/site/quickstart.md`

6 steps, each with a time budget:
1. Install (10s): `npm i @traits-dev/core @traits-dev/cli`
2. Init (10s): `npx traits init my-agent.yaml --template resolve`
3. Validate (10s): `npx traits validate my-agent.yaml --strict`
4. Compile + call LLM (40s): **Complete runnable script** that calls OpenAI and prints output
5. Eval (20s): `npx traits eval my-agent.yaml --tier 1`
6. Next steps: "Add to CI" | "Compose profiles" | "Customize voice"

**Critical:** Step 4 must include a copy-paste script that produces real LLM output. Current first-profile.md stops at "plug into your LLM stack" with a link.

#### 3. Eval Guide Expansion

**File:** `docs/site/guides/running-evaluations.md` — rewrite from 38 lines to ~200 lines

New sections:
1. When to use each tier (Tier 1 = every PR, Tier 2 = release candidates, Tier 3 = quarterly)
2. **Tier 1 scoring semantics:** Formula `0.25*preferred + 0.20*forbidden + 0.40*dimension_alignment + 0.15*helpfulness`, dimension signal scoring, verbosity proximity curves
3. **Tier 2 scoring semantics:** Embedding cosine similarity, `0.70*dim + 0.30*helpfulness`, knowledge-base patterns
4. **Tier 3 scoring semantics:** LLM judge per-dimension [0,1], same weighting, judge prompt template, noise characteristics
5. Writing custom eval samples
6. CLI examples with actual output
7. CI recommendation decision tree

#### 4. CLI Reference Page

**File:** `docs/site/reference/cli.md`

Document all 6 commands: `init`, `validate`, `compile`, `eval`, `import`, `migrate`
Each with: usage, options table, exit codes, examples.

### P1 — High Value (Do Second)

#### 5. Core Concepts Page

**File:** `docs/site/concepts.md`

Sections:
1. The problem with ad-hoc system prompts
2. Profile anatomy (meta, identity, voice, rules, capabilities)
3. The governance pipeline: define → validate → compile → inject → evaluate
4. Model-aware compilation (Claude vs GPT placement)
5. Composition as fleet governance (three-layer pattern)
6. Safety model (compile-time validation)
7. Evaluation tiers overview

#### 6. Safety & Validation Codes Reference

**File:** `docs/site/reference/safety-codes.md`

Every code (V001-V003, S001-S008) with: severity, trigger condition, example message, fix guidance.

#### 7. Integration Recipes Expansion

Add to `docs/site/guides/integrations.md`:
- OpenAI tool calling pattern
- Anthropic tool use pattern
- `injectPersonality()` usage (when and why)
- Multi-agent coordinator with actual tool policy enforcement
- LangChain / LangGraph pattern

### P2 — Important (Do Third)

#### 8. Eval Scoring Reference

**File:** `docs/site/reference/eval-scoring.md`

Reference companion to eval guide: weight tables, signal sets, embedding pipeline, judge prompt template, calibration baselines.

#### 9. CI/CD Pipeline Setup

**File:** `docs/site/guides/ci-cd.md`

GitHub Actions workflow YAML, JUnit format, token budget checks, multi-profile fleet validation, SARIF output.

#### 10. API Reference Revision

Add parameter tables, replace `unknown` types with documented shapes, add examples for every function.

#### 11. Schema Reference Revision

Add parameter tables, concrete conflict resolution examples, cross-links.

#### 12. First-Profile Guide Revision

Update to v1.6, add capabilities section, add compile output example, remove dead-end "plug into your LLM stack" step.

### P3 — Polish

- Remove showcase redirect page
- Add frontmatter metadata to all pages
- Cross-link related pages
- Terminology note in API reference: "The SDK uses `PersonalityProfile` as its core type name. This represents a voice and behavioral policy profile."

---

## Part 4: Terminology Strategy

**Problem:** `PersonalityProfile`, `CompiledPersonality`, `injectPersonality` are public API names locked by semver.

**Strategy:**
- API type/function names stay as-is (breaking change otherwise)
- All user-facing prose uses "voice policy profile", "behavioral policy", "compiled policy"
- Add a single terminology note in API reference explaining the naming
- Homepage, guides, and all new pages use "policy" language exclusively
- Never say "personality" in marketing copy or descriptions

---

## Part 5: Implementation Order

### Phase 1: Visual Foundation (1 session)
1. Rewrite `custom.css` with zero-radius, flat-color design tokens
2. Overhaul `LandingPage.vue` styles (zero radius, no gradients, no animations, grid lines)
3. Overhaul `PlaygroundPage.vue` styles
4. Verify dark mode

### Phase 2: Homepage Repositioning (1 session)
1. Rewrite hero copy (eyebrow, headline, subhead, CTAs)
2. Add 4th workflow card (Evaluate)
3. Add "Why governance" section
4. Update profile card descriptions
5. Update footer CTA

### Phase 3: Critical New Pages (1-2 sessions)
1. Write Quickstart page
2. Rewrite Eval guide with full scoring semantics
3. Write CLI Reference page
4. Wire new sidebar and nav in config.mts

### Phase 4: High-Value Pages (1-2 sessions)
1. Write Core Concepts page
2. Write Safety & Validation Codes reference
3. Expand Integration Recipes
4. Write Eval Scoring Reference

### Phase 5: Remaining Pages + Polish (1 session)
1. CI/CD Pipeline Setup guide
2. API Reference revision
3. Schema Reference revision
4. First-Profile guide revision
5. Cross-links, frontmatter, cleanup

---

## Acceptance Criteria

- [ ] Zero `border-radius` values in all Vue components and custom CSS
- [ ] Visible grid lines (borders) between all major sections
- [ ] All spacing on 8px multiples
- [ ] No CSS gradients, animations, or shadows
- [ ] Homepage positions as "governance SDK", not "voice styling tool"
- [ ] 90-second quickstart ends with a working LLM response
- [ ] Eval guide documents all three tier scoring formulas with actual weights
- [ ] CLI reference documents all 6 commands with flags and exit codes
- [ ] Safety codes reference documents all V001-V003 and S001-S008
- [ ] `docs:build` passes with zero errors
- [ ] All nav/sidebar links resolve correctly
