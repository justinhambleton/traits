# Landing Page & Interactive Showcase Redesign

**Date:** 2026-02-15
**Trigger:** Developer feedback that landing page is boring; showcase compares personas incorrectly across mismatched verticals
**Status:** Ready for implementation

---

## Problem Statement

The current traits.dev landing page is a plain markdown bullet list with install commands. It communicates what the product does but fails to demonstrate why anyone should care. The showcase forces cross-persona comparison with scenarios that don't match the persona's intended vertical (e.g., a healthcare persona responding to a billing dispute).

**What the research shows works:**
- Every compelling SDK landing page puts something functional in the developer's hands immediately (Vercel, Tailwind, tRPC)
- The best demos let users change inputs and see outputs update in real time (Tailwind Play, shadcn theme builders, OpenAI Playground)
- Pre-computed results with typing animation are nearly indistinguishable from live API calls
- Three-panel layout (config / preview / code) is the universal pattern for configuration tools
- Dark theme with single accent color signals "developer tool"
- Aggressive whitespace (80-120px between sections) signals premium

**Key technical insight:** `@traits-dev/core` is pure TypeScript with zero API dependencies. `compileProfile` and `validateProfile` can run entirely in the browser. This means we can build a genuine interactive playground where users adjust voice dimensions and see compiled output change in real time — zero backend, zero API cost, zero rate limiting. This is a significant advantage over AI products that require backend proxies for their demos.

---

## Architecture Decisions

### 1. Landing page as custom Vue layout, not markdown

The landing page needs full design control. VitePress supports custom Vue layouts alongside markdown docs. Structure:

- `/` — Custom Vue landing page component (not markdown)
- `/playground` — Interactive playground page (new, replaces current showcase)
- `/showcase` — Redirects to `/playground` (preserve existing links)
- `/schema-reference`, `/guides/*`, `/api/*` — Standard VitePress markdown (unchanged)

### 2. In-browser compilation (no backend needed)

Bundle `@traits-dev/core` into the docs site. The playground runs `compileProfile` and `validateProfile` client-side on every configuration change. This is the Tailwind Play pattern applied to voice profiles.

### 3. Pre-computed response library for LLM output

For demonstrating how compiled prompts affect LLM behavior, pre-compute responses for each built-in profile against domain-appropriate scenarios. Store as static JSON. Animate playback with typing effect. Optionally support BYOK (bring your own API key) for live responses.

### 4. Per-persona demo flows, not cross-comparison

Each profile gets its own demo context with domain-appropriate scenarios. Users explore one persona at a time, understanding how voice dimensions shape behavior within that vertical. Cross-comparison is available but secondary.

---

## Phase 1: Landing Page

### Hero Section

**Headline:** One bold line that names the problem. Not "Voice Profile SDK" — something like:

> "Your AI agents sound generic. Fix that."

or

> "Schema-driven voice for every AI agent."

**Subheadline:** One sentence that explains what the product does:

> "Define voice and behavioral policy as YAML. Validate safety at build time. Compile model-aware system prompts."

**Dual CTA:**
- Primary: `npm i @traits-dev/core` (copy-to-clipboard, styled as a terminal command)
- Secondary: "Try the Playground" button linking to `/playground`

**Visual element below the fold:** An animated transition showing a YAML snippet compiling into a system prompt block, with voice dimension labels morphing as values change. This can be a lightweight CSS/JS animation with pre-set keyframes — not a live compiler, just visual storytelling.

### Three-Step Workflow Section

Progressive narrative showing the Define → Validate → Compile workflow:

**Step 1: Define**
```yaml
voice:
  formality: low
  warmth: very-high
  directness: high
  humor:
    target: low
    style: dry
```

**Step 2: Validate**
```
$ traits validate my-profile.yaml
  S001 ✓  No unsafe instructions
  S008 ✓  Grounding constraints present
  Schema v1.6 valid — 0 errors, 0 warnings
```

**Step 3: Compile**
```
[VOICE TARGETS]
formality: low
warmth: very-high
directness: high
humor: low (dry)

[PATTERN GUIDANCE]
- warmth (very-high): Use strong compassionate
  framing with genuine validation...
- directness (high): Start with decisive action
  steps, minimize hedging...

[CAPABILITY BOUNDARIES]
Tools: (none — advisory only)
Constraints:
- Never claim actions without tool confirmation
```

Each step appears as a code block that animates in sequence (scroll-triggered or timed). The code blocks should use dark backgrounds with syntax highlighting even if the page is in light mode.

### Profile Cards Section

Three cards, one per built-in profile, each with:
- Profile name and one-line description
- Accent color (haven=teal, resolve=blue, architect=orange)
- The 6 voice dimension values as a visual bar chart or radar chart
- One domain-appropriate sample exchange (prompt + response snippet)
- "Explore in Playground" link

Each card shows a scenario that makes sense for the persona:
- **Haven:** "I've been having chest pains after exercise. Should I be worried?"
- **Resolve:** "You charged me twice this month and support ignored me. Fix this now."
- **Architect:** "My Node service crashes with TypeError at startup. Where should I look?"

### Integration Section

Compact code blocks showing where compiled output goes:

```typescript
// OpenAI
const response = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [
    { role: "system", content: compiled.text },
    { role: "user", content: userMessage }
  ]
});
```

```typescript
// Anthropic
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-5-20250929",
  system: compiled.text,
  messages: [{ role: "user", content: userMessage }]
});
```

Two tabs, minimal code, copy buttons. Show that integration is two lines.

### Trust Signals

- npm weekly downloads badge
- GitHub stars badge
- MIT license badge
- "v0.4.0 — Schema v1.6" version badge

No fake social proof. At this stage, badges and version number are the honest trust signals.

### Footer CTA

Repeat the dual CTA: install command + playground link.

### Visual Design Specification

- **Typography:** Inter (body), JetBrains Mono or Geist Mono (code)
- **Color palette:** Near-black background (`#0a0a0a`) for hero and code sections, white/light gray for text sections in light mode. Single accent color per section (blue default, persona accents for profile cards).
- **Spacing:** 80-120px between major sections. 24-40px within sections.
- **Code blocks:** Dark background (`#0f172a` or similar), rounded corners (`border-radius: 12px`), subtle border, copy button. Syntax highlighting via Shiki (VitePress built-in).
- **Animations:** Scroll-triggered fade-in for sections. Typing animation for the compile step. Subtle, not gratuitous.
- **Responsive:** Single column below 768px. Hero scales gracefully. Code blocks scroll horizontally on mobile.
- **Dark/light mode:** Full support. Code blocks stay dark in both modes. VitePress handles theme toggling.

### Phase 1 Acceptance Criteria

- [ ] Landing page is a custom Vue layout, not markdown
- [ ] Hero with headline, subheadline, dual CTA (install command with copy + playground link)
- [ ] Three-step animated workflow section (Define → Validate → Compile)
- [ ] Three profile cards with domain-appropriate scenarios and visual voice dimensions
- [ ] Integration code snippets (OpenAI + Anthropic tabs)
- [ ] Trust signal badges
- [ ] Dark code blocks, proper typography, 80px+ section spacing
- [ ] Responsive layout (mobile-friendly)
- [ ] Dark/light mode support
- [ ] `pnpm docs:build` passes

---

## Phase 2: Interactive Playground

This is the highest-leverage page on the site. It replaces the current static showcase.

### Architecture

The playground runs `@traits-dev/core` in the browser. No API calls needed for compilation and validation. The page has three panels:

```
+---------------------------+---------------------------+
|   CONFIGURATION PANEL     |   COMPILED OUTPUT PANEL   |
|   ----------------------  |   ----------------------  |
|   Profile: [haven ▼]     |   [TRAITS PERSONALITY]    |
|                           |   Name: haven             |
|   Voice Dimensions:       |   ...                     |
|   Formality   [====o===] |   [VOICE TARGETS]         |
|   Warmth      [=======o] |   formality: medium       |
|   Verbosity   [====o===] |   warmth: very-high       |
|   Directness  [====o===] |   ...                     |
|   Empathy     [=======o] |                           |
|   Humor       [o=======] |   [PATTERN GUIDANCE]      |
|                           |   - warmth (very-high)... |
|   Scenario:               |   ...                     |
|   [Chest pain question ▼] |                           |
|   ----------------------  |   [CAPABILITY BOUNDARIES] |
|   YAML Source (readonly)  |   Tools: (none)           |
|   ```yaml                 |   ...                     |
|   schema: "v1.6"          |                           |
|   voice:                  |                           |
|     formality: medium     |                           |
|   ```                     |                           |
+---------------------------+---------------------------+
|   RESPONSE PANEL                                      |
|   --------------------------------------------------  |
|   How the compiled prompt affects LLM behavior:       |
|   [Pre-computed response with typing animation]       |
|   --------------------------------------------------  |
|   Score: Tier 1 = 0.85  |  [Try with your API key]   |
+-------------------------------------------------------+
```

### Configuration Panel

**Profile selector:** Dropdown to choose haven, resolve, or architect as a starting point. Loading a profile populates all sliders and the YAML source.

**Voice dimension sliders:** Six sliders, one per dimension. Each has 5 discrete stops (very-low, low, medium, high, very-high). Dragging a slider:
1. Updates the in-memory profile object
2. Reruns `compileProfile()` in the browser
3. Updates the compiled output panel in real time
4. Updates the YAML source display
5. Checks if the current configuration matches a pre-computed response set

**Humor style selector:** When humor is not `very-low`, show a dropdown for style (dry, subtle-wit, playful).

**Scenario selector:** Dropdown of domain-appropriate scenarios for the currently selected profile. Scenarios are grouped by profile:
- Haven scenarios: symptom questions, medication concerns, wellness check-ins
- Resolve scenarios: billing disputes, technical troubleshooting, escalation requests
- Architect scenarios: debugging, architecture review, code review

**YAML source:** Read-only code block showing the current profile YAML. Updates as sliders change. Serves as a teaching tool — users learn the YAML format by watching it update as they drag sliders.

### Compiled Output Panel

Shows the full compiled system prompt text, syntax-highlighted. Updates in real time as configuration changes. This is the core "aha moment" — users see how moving the warmth slider from medium to very-high changes the `[PATTERN GUIDANCE]` section from "Blend support and utility" to "Use strong compassionate framing with genuine validation."

**Diff highlighting (optional but valuable):** When a slider changes, briefly highlight the lines in the compiled output that changed. This draws the eye to the effect of each dimension.

### Response Panel

Shows a pre-computed LLM response for the current profile + scenario combination. Displayed with typing animation to simulate streaming.

**Pre-computed response matrix:** For each of the 3 profiles, pre-compute responses for 3-4 domain-appropriate scenarios. Also pre-compute responses for 2-3 "slider variation" configurations per profile (e.g., haven with warmth=medium vs warmth=very-high) to show how dimension changes affect behavior.

Total pre-computed responses needed: ~30-40 (3 profiles x 3-4 scenarios x 2-3 configurations).

**Tier 1 score display:** Run `evaluateTier1Response` in the browser against the pre-computed response and show the score. This updates as the profile configuration changes (since the scoring rubric is based on the profile's voice targets).

**BYOK option:** A collapsed section at the bottom: "Want to see live responses? Paste your OpenAI or Anthropic API key." If provided, the key is stored in localStorage (never sent to any server), and the response panel makes direct API calls to the provider with the compiled system prompt. This eliminates all cost concerns while enabling live interaction for developers who want it.

### URL State

Serialize the current configuration (profile, dimension values, scenario) into URL query parameters or a compressed hash. This enables:
- Shareable playground links
- Linking from docs to specific configurations
- Browser back/forward navigation between configurations

### Technical Implementation

**Bundling core into the docs site:** Add `@traits-dev/core` as a dependency of the docs site. VitePress/Vite will bundle it. The playground component imports `compileProfile`, `validateProfile`, and `evaluateTier1Response` directly.

**Profile loading:** The 3 built-in profiles (haven, resolve, architect) are bundled as JSON (pre-parsed from YAML at build time via the showcase build script pattern). The playground loads them as starting points.

**Debouncing:** Slider changes trigger recompilation on a 50ms debounce to prevent jank during rapid dragging.

**Code editor (optional upgrade):** Replace the read-only YAML display with a CodeMirror editor that allows direct YAML editing. Parse the edited YAML and update sliders to match. This creates a bidirectional binding: sliders → YAML → compiled, or YAML → sliders → compiled.

### Phase 2 Acceptance Criteria

- [ ] Playground page with three-panel layout (config / compiled output / response)
- [ ] Profile selector loads built-in profiles
- [ ] Six voice dimension sliders with discrete 5-stop positions
- [ ] Sliders trigger in-browser `compileProfile()` and update compiled output in real time
- [ ] YAML source display updates as sliders change
- [ ] Scenario selector with domain-appropriate scenarios per profile
- [ ] Pre-computed response library (~30-40 responses) displayed with typing animation
- [ ] Tier 1 score displayed and updates with configuration changes
- [ ] BYOK API key input for optional live responses (localStorage only)
- [ ] URL state serialization for shareable links
- [ ] Responsive layout (stacked panels on mobile)
- [ ] Dark/light mode support
- [ ] Old `/showcase` URL redirects to `/playground`
- [ ] `pnpm docs:build` passes

---

## Phase 3: Pre-Computed Response Library

This is the data pipeline that powers the playground's response panel.

### Build Script

Extend the existing `build-showcase-data.mjs` pattern:

1. For each profile (haven, resolve, architect):
   a. Load the profile YAML
   b. For each of 3-4 domain-appropriate scenarios:
      - Compile the profile with `compileProfile()`
      - Call the LLM (gpt-4o or similar) with the compiled system prompt + scenario prompt
      - Store the response
      - Run `evaluateTier1Response()` and store the score
   c. For each of 2-3 dimension variations (e.g., warmth=medium, directness=very-high):
      - Modify the profile's voice dimensions
      - Repeat compile → generate → score
2. Output a structured JSON file consumed by the playground

### Scenario Selection

Each profile gets scenarios that make sense for its vertical:

**Haven (healthcare):**
- "I've been having chest pains after exercise. Should I be worried?"
- "My doctor prescribed a new medication but I'm nervous about side effects."
- "Can you help me understand my cholesterol results?"

**Resolve (customer support):**
- "You charged me twice this month and support ignored me. Fix this now."
- "I want to return this product but it's past the return window."
- "My internet has been dropping every evening for a week."

**Architect (developer):**
- "My Node service crashes with TypeError at startup. Where should I look?"
- "Should I use a monorepo or separate repos for our microservices?"
- "Review this PR — I refactored the auth middleware."

### Dimension Variations

For each profile, pre-compute responses with 2-3 alternative configurations to show how dimension changes affect output:

- **Haven default** (warmth=very-high, empathy=very-high) vs **Haven clinical** (warmth=medium, empathy=medium, formality=high)
- **Resolve default** (directness=high, warmth=high) vs **Resolve formal** (directness=medium, formality=high, warmth=medium)
- **Architect default** (directness=very-high, verbosity=low) vs **Architect verbose** (verbosity=high, directness=medium)

### Phase 3 Acceptance Criteria

- [ ] Build script generates response library for all profiles + scenarios + variations
- [ ] Responses stored as static JSON in docs site data directory
- [ ] Each response includes: profile config, scenario, compiled prompt, LLM response, Tier 1 score
- [ ] Playground loads and displays pre-computed responses correctly
- [ ] Typing animation plays on response display
- [ ] Score updates when configuration matches a different pre-computed variant

---

## Phase 4: Polish & Optimization

### Performance

- Lazy-load the playground page (don't bundle core into the landing page)
- Code-split the BYOK API call logic (only loaded if user opts in)
- Compress pre-computed response JSON
- Use `IntersectionObserver` for scroll-triggered animations on landing page

### SEO

- Landing page meta tags: title, description, og:image
- Structured data for the npm package
- Canonical URL: `https://traits.dev`

### Analytics

- Track playground engagement: which profiles are selected, which sliders are moved, which scenarios are chosen
- Track BYOK adoption rate
- Track conversion: playground → docs → npm install

### Phase 4 Acceptance Criteria

- [ ] Lighthouse performance score > 90 on landing page
- [ ] Playground loads in < 2 seconds on 3G
- [ ] Meta tags and og:image configured
- [ ] Analytics events firing for key interactions

---

## Sequencing

| Phase | What | Dependency |
|-------|------|------------|
| 1 | Landing page redesign | None |
| 2 | Interactive playground | Phase 1 (needs the page structure) |
| 3 | Pre-computed response library | Phase 2 (playground consumes the data) |
| 4 | Polish & optimization | Phases 1-3 complete |

**Phase 1 is the priority.** The landing page is what every visitor sees first. The playground is linked from it but can ship as a follow-up. Phase 3 (pre-computed responses) can be built incrementally — start with just the 3 default profile configurations and expand.

**Do not redesign the docs pages (guides, schema reference, API).** Those are functional and correct. Only the landing page and showcase need redesign.

---

## What NOT to Build

- **Full code editor with YAML editing.** Start with sliders only. Code editor is a Phase 2+ upgrade if adoption justifies it.
- **Live LLM responses as default.** Pre-computed with typing animation is the default. BYOK is opt-in.
- **Multiple AI provider support in BYOK.** Start with OpenAI only. Add Anthropic later.
- **User accounts or saved configurations.** URL state is sufficient. No auth, no database.
- **Animated 3D visualizations.** Subtle scroll animations and typing effects only. No WebGL, no Three.js, no gratuitous motion.
