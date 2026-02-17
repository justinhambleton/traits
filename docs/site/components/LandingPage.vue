<template>
  <div class="landing-shell">
    <section class="hero section">
      <div class="hero-copy">
        <p class="eyebrow">Governance SDK for AI Agent Behavior</p>
        <h1>Govern agent behavior across your fleet. Start in 90 seconds.</h1>
        <p class="subhead">
          Define voice and behavioral policy as composable YAML profiles.
          Validate safety at build time. Compile model-aware system prompts.
          Evaluate adherence across your agent fleet.
        </p>
        <button class="install-command" type="button" @click="copyInstallCommand">
          <code>npm i @traits-dev/core @traits-dev/cli</code>
          <span>{{ installCopied ? "Copied" : "Copy" }}</span>
        </button>
        <div class="hero-buttons">
          <a class="hero-btn" :href="links.playground">Quickstart</a>
          <a class="hero-btn" :href="links.overview">Documentation</a>
        </div>
      </div>
    </section>

    <section class="workflow section">
      <h2>Define. Validate. Compile. Evaluate.</h2>
      <div class="workflow-grid">
        <article v-for="(step, index) in workflowSteps" :key="step.title" class="step-card">
          <p class="step-index">0{{ index + 1 }}</p>
          <h3>{{ step.title }}</h3>
          <pre><code>{{ step.code }}</code></pre>
        </article>
      </div>
    </section>

    <section class="governance section">
      <h2>Why governance, not just prompting</h2>
      <div class="governance-grid">
        <article v-for="card in governanceCards" :key="card.title" class="governance-card">
          <h3>{{ card.title }}</h3>
          <p>{{ card.description }}</p>
        </article>
      </div>
    </section>

    <section class="profiles section">
      <h2>Starter policy profiles</h2>
      <p class="section-lede">
        Each profile defines voice targets, behavioral rules, and capability boundaries
        for a specific domain. Use them as base policies or extend them for your fleet.
      </p>
      <div class="profile-tabs">
        <button
          v-for="profile in profiles"
          :key="profile.id"
          type="button"
          :class="{ active: activeProfile === profile.id }"
          :style="activeProfile === profile.id ? { background: profile.accent, borderColor: profile.accent } : {}"
          @click="activeProfile = profile.id"
        >
          {{ profile.name }}
        </button>
      </div>
      <article
        v-for="profile in profiles"
        :key="profile.id"
        class="profile-detail"
        :style="{ '--profile-accent': profile.accent }"
        v-show="activeProfile === profile.id"
      >
        <div class="profile-detail-top">
          <div class="profile-detail-info">
            <h3>{{ profile.title }}</h3>
            <p class="profile-desc">{{ profile.description }}</p>
            <div class="sample">
              <p class="sample-label">Scenario</p>
              <p class="sample-prompt">{{ profile.sample.prompt }}</p>
              <p class="sample-label">Response style</p>
              <p class="sample-response">{{ profile.sample.response }}</p>
            </div>
            <a class="profile-link" :href="`${links.playground}?profile=${profile.id}`">Explore in Playground</a>
          </div>
          <div class="profile-detail-dims">
            <p class="dims-label">Voice dimensions</p>
            <div class="dimension-bars">
              <div v-for="dimension in profile.dimensions" :key="`${profile.id}-${dimension.name}`" class="dimension-row">
                <span>{{ dimension.name }}</span>
                <div class="bar-track">
                  <div class="bar-fill" :style="{ width: `${levelPercent(dimension.value)}%`, background: profile.accent }" />
                </div>
                <strong>{{ dimension.value }}</strong>
              </div>
            </div>
          </div>
        </div>
      </article>
    </section>

    <section class="integrations section">
      <h2>Integration is two lines</h2>
      <div class="integration-tabs">
        <button
          v-for="tab in integrationTabs"
          :key="tab.id"
          type="button"
          :class="{ active: activeTab === tab.id }"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </div>
      <div class="integration-code">
        <button class="copy-snippet" type="button" @click="copyActiveSnippet">
          {{ snippetCopied ? "Copied" : "Copy" }}
        </button>
        <pre><code>{{ activeSnippet.code }}</code></pre>
      </div>
    </section>

    <section class="trust section">
      <h2>Trust signals</h2>
      <div class="badge-row">
        <a
          v-for="badge in trustBadges"
          :key="badge.alt"
          :href="badge.href"
          target="_blank"
          rel="noreferrer"
          class="badge"
        >
          <img :src="badge.src" :alt="badge.alt" />
        </a>
      </div>
    </section>

    <footer class="site-footer">
      <p>
        &copy; {{ new Date().getFullYear() }}
        <a href="https://frntr.ai" target="_blank" rel="noreferrer">FRNTR, LLC</a>.
        All rights reserved.
        <span aria-hidden="true"> · </span>
        <a :href="links.llms">llms.txt</a>
      </p>
      <p class="built-in">Built in California</p>
    </footer>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import { withBase } from "vitepress";

const installCopied = ref(false);
const snippetCopied = ref(false);
const activeProfile = ref("haven");

const links = {
  overview: withBase("/overview"),
  playground: withBase("/playground/"),
  llms: withBase("/llms.txt")
};

const workflowSteps = [
  {
    title: "Define",
    code: `voice:
  formality: low
  warmth: very-high
  directness: high
  humor:
    target: low
    style: dry`
  },
  {
    title: "Validate",
    code: `$ traits validate my-profile.yaml
  S001  PASS  No unsafe instructions
  S008  PASS  Grounding constraints present
  Schema v1.6 valid — 0 errors, 0 warnings`
  },
  {
    title: "Compile",
    code: `[VOICE TARGETS]
formality: low
warmth: very-high
directness: high

[CAPABILITY BOUNDARIES]
Tools: (none — advisory only)
Constraints:
- Never claim actions without tool confirmation`
  },
  {
    title: "Evaluate",
    code: `$ traits eval my-profile.yaml --tier 1
  Tier 1 — 5 samples
  avg score: 0.72
  vocabulary: 4/5 preferred, 0 forbidden
  dimensions: directness 0.86, warmth 0.71
  PASS — all checks above threshold`
  }
];

const governanceCards = [
  {
    title: "Composable Policy",
    description:
      "Define voice, rules, and capability boundaries as structured YAML. Extend base profiles with array-merge composition. Share constraints across your agent fleet without copy-pasting prompt fragments."
  },
  {
    title: "Build-Time Safety",
    description:
      "Validate profiles against 8 safety checks before they reach production. Catch unsafe instructions, missing grounding constraints, and schema violations at CI time — not after deployment."
  },
  {
    title: "Fleet Evaluation",
    description:
      "Score agent responses against profile policy with three evaluation tiers. Tier 1 runs locally in milliseconds. Tier 2 uses embeddings. Tier 3 uses LLM judges. Gate releases on adherence scores."
  }
];

const profiles = [
  {
    id: "haven",
    name: "haven",
    title: "Healthcare Companion",
    accent: "#14b8a6",
    description: "High-empathy care navigation with medical escalation rules and grounding constraints that prevent unsupervised clinical claims.",
    dimensions: [
      { name: "Formality", value: "medium" },
      { name: "Warmth", value: "very-high" },
      { name: "Verbosity", value: "medium" },
      { name: "Directness", value: "medium" },
      { name: "Empathy", value: "very-high" },
      { name: "Humor", value: "very-low" }
    ],
    sample: {
      prompt: "I've been having chest pains after exercise. Should I be worried?",
      response:
        "Acknowledge fear clearly, escalate urgent symptoms immediately, and frame next steps as recommendations for the care team."
    }
  },
  {
    id: "resolve",
    name: "resolve",
    title: "Customer Resolution Specialist",
    accent: "#3b82f6",
    description: "Ownership-first support policy with forbidden-term enforcement, escalation rules, and controlled directness constraints.",
    dimensions: [
      { name: "Formality", value: "medium" },
      { name: "Warmth", value: "high" },
      { name: "Verbosity", value: "medium" },
      { name: "Directness", value: "high" },
      { name: "Empathy", value: "high" },
      { name: "Humor", value: "very-low" }
    ],
    sample: {
      prompt: "You charged me twice this month and support ignored me. Fix this now.",
      response:
        "Lead with acknowledgment, move directly into resolution steps, and avoid policy-deflecting language."
    }
  },
  {
    id: "architect",
    name: "architect",
    title: "Developer Assistant",
    accent: "#f97316",
    description: "Implementation-first engineering policy with capability boundaries, terse output constraints, and tool-grounding rules.",
    dimensions: [
      { name: "Formality", value: "low" },
      { name: "Warmth", value: "medium" },
      { name: "Verbosity", value: "low" },
      { name: "Directness", value: "very-high" },
      { name: "Empathy", value: "medium" },
      { name: "Humor", value: "low" }
    ],
    sample: {
      prompt: "My Node service crashes with TypeError at startup. Where should I look?",
      response:
        "Start with Root cause / Patch / Next check framing and prioritize concrete triage commands over theory."
    }
  },
  {
    id: "educator",
    name: "educator",
    title: "Learning Companion",
    accent: "#a78bfa",
    description: "Guided tutoring policy with Socratic questioning, scaffolded explanations, and encouragement-first feedback that adapts to learner confidence.",
    dimensions: [
      { name: "Formality", value: "low" },
      { name: "Warmth", value: "high" },
      { name: "Verbosity", value: "medium" },
      { name: "Directness", value: "medium" },
      { name: "Empathy", value: "high" },
      { name: "Humor", value: "low" }
    ],
    sample: {
      prompt: "I don't understand recursion at all. Can you help with my homework?",
      response:
        "Start with encouragement, then walk through the concept using a concrete analogy before guiding the student to solve it themselves."
    }
  },
  {
    id: "advisor",
    name: "advisor",
    title: "Regulated Advisory Assistant",
    accent: "#facc15",
    description: "Risk-aware financial guidance policy with regulatory disclaimers, concentration-risk warnings, and mandatory referral-to-licensed-professional constraints.",
    dimensions: [
      { name: "Formality", value: "high" },
      { name: "Warmth", value: "medium" },
      { name: "Verbosity", value: "medium" },
      { name: "Directness", value: "high" },
      { name: "Empathy", value: "medium" },
      { name: "Humor", value: "very-low" }
    ],
    sample: {
      prompt: "Should I put all my savings into Bitcoin?",
      response:
        "Flag concentration risk, explain diversification principles, and always include a disclaimer to consult a licensed financial advisor."
    }
  }
];

const integrationTabs = [
  {
    id: "openai",
    label: "OpenAI",
    code: `const compiled = compileProfile("profiles/resolve.yaml", { model: "gpt-4o" });

const response = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [
    { role: "system", content: compiled.text },
    { role: "user", content: userMessage }
  ]
});`
  },
  {
    id: "anthropic",
    label: "Anthropic",
    code: `const compiled = compileProfile("profiles/resolve.yaml", { model: "claude-sonnet-4-5-20250929" });

const response = await anthropic.messages.create({
  model: "claude-sonnet-4-5-20250929",
  system: compiled.text,
  messages: [{ role: "user", content: userMessage }]
});`
  }
];

const activeTab = ref("openai");
const activeSnippet = computed(
  () => integrationTabs.find((tab) => tab.id === activeTab.value) ?? integrationTabs[0]
);

const trustBadges = [
  {
    alt: "core weekly downloads",
    href: "https://www.npmjs.com/package/@traits-dev/core",
    src: "https://img.shields.io/npm/dw/%40traits-dev%2Fcore?style=flat-square&label=core%20weekly%20downloads"
  },
  {
    alt: "core version",
    href: "https://www.npmjs.com/package/@traits-dev/core",
    src: "https://img.shields.io/npm/v/%40traits-dev%2Fcore?style=flat-square&label=%40traits-dev%2Fcore"
  },
  {
    alt: "cli version",
    href: "https://www.npmjs.com/package/@traits-dev/cli",
    src: "https://img.shields.io/npm/v/%40traits-dev%2Fcli?style=flat-square&label=%40traits-dev%2Fcli"
  },
  {
    alt: "github stars",
    href: "https://github.com/justinhambleton/traits",
    src: "https://img.shields.io/github/stars/justinhambleton/traits?style=flat-square"
  },
  {
    alt: "license",
    href: "https://github.com/justinhambleton/traits/blob/main/LICENSE",
    src: "https://img.shields.io/badge/license-MIT-0f172a?style=flat-square"
  },
  {
    alt: "schema v1.6",
    href: withBase("/schema-reference"),
    src: "https://img.shields.io/badge/schema-v1.6-1d4ed8?style=flat-square"
  }
];

async function copyInstallCommand() {
  try {
    await navigator.clipboard.writeText("npm i @traits-dev/core @traits-dev/cli");
    installCopied.value = true;
    window.setTimeout(() => {
      installCopied.value = false;
    }, 1600);
  } catch {
    installCopied.value = false;
  }
}

async function copyActiveSnippet() {
  try {
    await navigator.clipboard.writeText(activeSnippet.value.code);
    snippetCopied.value = true;
    window.setTimeout(() => {
      snippetCopied.value = false;
    }, 1600);
  } catch {
    snippetCopied.value = false;
  }
}

function levelPercent(level) {
  const scale = {
    "very-low": 18,
    low: 34,
    medium: 52,
    high: 72,
    "very-high": 92
  };
  return scale[level] ?? 50;
}
</script>

<style scoped>
.landing-shell {
  --ink: #e5e7eb;
  --muted: #9ca3af;
  --surface: #1b1a1f;
  --surface-2: #111827;
  --surface-3: #111827;
  --border: #374151;
  --accent: #FFA77F;
  color: var(--ink);
  background: var(--surface);
  min-height: 100vh;
  padding-bottom: 64px;
}

.section {
  width: min(1120px, calc(100% - 2rem));
  margin: 0 auto;
  padding-top: 64px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 64px;
}

.section:last-child {
  border-bottom: none;
}

.hero-copy {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.eyebrow {
  margin: 0;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 0.76rem;
  color: var(--accent);
}

.hero h1 {
  margin: 16px 0 0;
  font-size: clamp(2.2rem, 6vw, 4.1rem);
  line-height: 1.02;
  color: #f8fafc;
  max-width: 24ch;
}

.subhead {
  margin: 24px 0 0;
  color: #d1d5db;
  font-size: 1.06rem;
  max-width: 56ch;
  line-height: 1.5;
}

.install-command {
  margin-top: 32px;
  border: 1px solid var(--border);
  background: #0f172a;
  color: #e5e7eb;
  border-radius: 0;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 16px;
  cursor: pointer;
  font-size: 0.88rem;
  font-family: var(--vp-font-family-mono);
}

.install-command span {
  color: var(--accent);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.68rem;
}

.hero-buttons {
  margin-top: 16px;
  display: flex;
  gap: 8px;
}

.hero-btn {
  border-radius: 0;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--ink);
  text-decoration: none;
  font-weight: 700;
  padding: 12px 24px;
}

.hero-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.workflow h2,
.governance h2,
.profiles h2,
.integrations h2,
.trust h2 {
  margin: 0;
  font-size: clamp(1.6rem, 2.2vw, 2.35rem);
}

.workflow-grid {
  margin-top: 24px;
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.governance-grid {
  margin-top: 24px;
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.governance-card {
  border: 1px solid var(--border);
  background: var(--surface-2);
  padding: 24px;
}

.governance-card h3 {
  margin: 0 0 8px;
  font-size: 1.05rem;
}

.governance-card p {
  margin: 0;
  color: #d1d5db;
  line-height: 1.5;
  font-size: 0.9rem;
}

.step-card {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 0;
  padding: 16px;
}

.step-card:nth-child(2) {
}

.step-card:nth-child(3) {
}

.step-index {
  margin: 0;
  color: var(--accent);
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.1em;
}

.step-card h3 {
  margin: 4px 0 8px;
}

.step-card pre {
  margin: 0;
  border-radius: 0;
  border: 1px solid var(--border);
  background: #0f172a;
  padding: 16px;
  min-height: 220px;
  overflow-x: auto;
  color: #e5e7eb;
  font-size: 0.72rem;
  line-height: 1.45;
}

.section-lede {
  margin: 8px 0 0;
  color: #d1d5db;
  max-width: 72ch;
}

.profile-tabs {
  margin-top: 24px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.profile-tabs button {
  border: 1px solid var(--border);
  border-radius: 0;
  padding: 8px 20px;
  background: var(--surface-2);
  color: #9ca3af;
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
  text-transform: lowercase;
  letter-spacing: 0.02em;
}

.profile-tabs button.active {
  color: #1F2937;
}

.profile-tabs button:not(.active):hover {
  border-color: var(--accent);
  color: var(--ink);
}

.profile-detail {
  margin-top: 16px;
  border: 1px solid var(--border);
  background: var(--surface-2);
}

.profile-detail-top {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
}

.profile-detail-info {
  padding: 24px;
  border-right: 1px solid var(--border);
}

.profile-detail-info h3 {
  margin: 0;
  font-size: 1.3rem;
}

.profile-desc {
  margin: 8px 0 0;
  color: #d1d5db;
  line-height: 1.5;
  font-size: 0.92rem;
}

.profile-detail-dims {
  padding: 24px;
}

.dims-label {
  margin: 0 0 16px;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #9ca3af;
  font-weight: 700;
}

.dimension-bars {
  display: grid;
  gap: 12px;
}

.dimension-row {
  display: grid;
  grid-template-columns: 88px 1fr auto;
  gap: 8px;
  align-items: center;
}

.dimension-row span {
  color: #9ca3af;
  font-size: 0.78rem;
}

.dimension-row strong {
  color: #e5e7eb;
  text-transform: capitalize;
  font-size: 0.73rem;
}

.bar-track {
  border-radius: 0;
  height: 8px;
  background: #273345;
}

.bar-fill {
  height: 100%;
  border-radius: 0;
}

.sample {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.sample-label {
  margin: 8px 0 4px;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #9ca3af;
}

.sample-label:first-child {
  margin-top: 0;
}

.sample-prompt {
  margin: 0;
  color: #e5e7eb;
  font-weight: 600;
}

.sample-response {
  margin: 0;
  color: #d1d5db;
  line-height: 1.5;
}

.profile-link {
  display: inline-block;
  margin-top: 16px;
  text-decoration: none;
  color: var(--profile-accent, var(--accent));
  font-weight: 600;
}

.profile-link:hover {
  color: #ffcbb0;
}

.integration-tabs {
  margin-top: 16px;
  display: flex;
  gap: 8px;
}

.integration-tabs button {
  border: 1px solid var(--border);
  border-radius: 0;
  padding: 8px 16px;
  background: var(--surface-2);
  color: #9ca3af;
  font-weight: 700;
  cursor: pointer;
}

.integration-tabs button.active {
  background: #FFA77F;
  border-color: #FFA77F;
  color: #1F2937;
}

.integration-code {
  position: relative;
  margin-top: 8px;
}

.copy-snippet {
  position: absolute;
  top: 8px;
  right: 8px;
  border: 1px solid var(--border);
  border-radius: 0;
  background: var(--surface-2);
  color: var(--accent);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
  padding: 4px 8px;
  cursor: pointer;
}

.integration-code pre {
  margin: 0;
  border-radius: 0;
  border: 1px solid var(--border);
  background: #0f172a;
  color: #e5e7eb;
  padding: 16px;
  overflow-x: auto;
  min-height: 210px;
}

.badge-row {
  margin-top: 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.badge {
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: 0;
  overflow: hidden;
}

.badge img {
  display: block;
  height: 28px;
}

.site-footer {
  width: min(1120px, calc(100% - 2rem));
  margin: 0 auto;
  padding: 32px 0 24px;
  border-top: 1px solid var(--border);
  text-align: center;
}

.site-footer p {
  margin: 0;
  color: var(--muted);
  font-size: 0.82rem;
}

.site-footer a {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 0.15em;
}

.site-footer .built-in {
  margin-top: 8px;
  font-size: 0.75rem;
  letter-spacing: 0.04em;
}

@media (max-width: 1024px) {
  .workflow-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .governance-grid {
    grid-template-columns: 1fr;
  }

  .profile-detail-top {
    grid-template-columns: 1fr;
  }

  .profile-detail-info {
    border-right: none;
    border-bottom: 1px solid var(--border);
  }
}

@media (max-width: 768px) {
  .section {
    padding-top: 48px;
    padding-bottom: 48px;
  }

  .hero h1 {
    max-width: 100%;
  }

  .workflow-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .install-command {
    font-size: 0.78rem;
  }

  .hero-buttons {
    flex-direction: column;
    width: 100%;
  }

  .hero-btn {
    text-align: center;
  }
}

@media (max-width: 480px) {
  .workflow-grid {
    grid-template-columns: 1fr;
  }

  .install-command code {
    font-size: 0.72rem;
  }
}

:global(html:not(.dark)) .landing-shell {
  --ink: #0a0a0a;
  --muted: #6b7280;
  --surface: #ffffff;
  --surface-2: #f8f9fa;
  --surface-3: #ffffff;
  --border: #d1d5db;
  background: #ffffff;
}


:global(html:not(.dark)) .hero h1 {
  color: #0a0a0a;
}

:global(html:not(.dark)) .subhead {
  color: #374151;
}

:global(html:not(.dark)) .eyebrow {
  color: #FFA77F;
}

:global(html:not(.dark)) .install-command {
  background: #0a0a0a;
  border-color: #374151;
  color: #e5e7eb;
}

:global(html:not(.dark)) .hero-btn {
  background: #f8f9fa;
  border-color: #d1d5db;
  color: #0a0a0a;
}

:global(html:not(.dark)) .hero-btn:hover {
  border-color: #FFA77F;
  color: #FFA77F;
}

:global(html:not(.dark)) .workflow h2,
:global(html:not(.dark)) .governance h2,
:global(html:not(.dark)) .profiles h2,
:global(html:not(.dark)) .integrations h2,
:global(html:not(.dark)) .trust h2 {
  color: #0a0a0a;
}

:global(html:not(.dark)) .governance-card {
  background: #f8f9fa;
  border-color: #d1d5db;
}

:global(html:not(.dark)) .governance-card p {
  color: #374151;
}

:global(html:not(.dark)) .section-lede {
  color: #374151;
}

:global(html:not(.dark)) .step-card {
  background: #f8f9fa;
  border-color: #d1d5db;
}

:global(html:not(.dark)) .step-card pre {
  border-color: #374151;
}

:global(html:not(.dark)) .profile-tabs button {
  background: #ffffff;
  border-color: #d1d5db;
}

:global(html:not(.dark)) .profile-detail {
  background: #ffffff;
  border-color: #d1d5db;
}

:global(html:not(.dark)) .profile-detail-info {
  border-color: #d1d5db;
}

:global(html:not(.dark)) .profile-desc,
:global(html:not(.dark)) .sample-response {
  color: #374151;
}

:global(html:not(.dark)) .sample-prompt,
:global(html:not(.dark)) .profile-detail-info h3 {
  color: #0a0a0a;
}

:global(html:not(.dark)) .dimension-row strong {
  color: #1f2937;
}

:global(html:not(.dark)) .bar-track {
  background: #e5e7eb;
}

:global(html:not(.dark)) .profile-link {
  color: #374151;
}

:global(html:not(.dark)) .integration-tabs button {
  background: #ffffff;
  border-color: #d1d5db;
}

:global(html:not(.dark)) .integration-tabs button.active {
  background: #FFA77F;
  border-color: #FFA77F;
  color: #1F2937;
}

:global(html:not(.dark)) .integration-code pre {
  border-color: #374151;
}

:global(html:not(.dark)) .copy-snippet {
  background: #f8f9fa;
  border-color: #d1d5db;
  color: #FFA77F;
}

:global(html:not(.dark)) .badge {
  border-color: #d1d5db;
}
</style>
