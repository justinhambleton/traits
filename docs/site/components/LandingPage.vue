<template>
  <div class="landing-shell">
    <header class="top-nav">
      <a class="brand" :href="links.home">traits.dev</a>
      <nav>
        <a :href="links.quickstart">Quickstart</a>
        <a :href="links.playground">Playground</a>
        <a :href="links.guides">Guides</a>
        <a :href="links.reference">Reference</a>
        <a :href="links.api">API</a>
      </nav>
      <a class="github-link" href="https://github.com/justinhambleton/traits" target="_blank" rel="noreferrer" aria-label="GitHub">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
      </a>
    </header>

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
      <div class="profile-grid">
        <article
          v-for="profile in profiles"
          :key="profile.id"
          class="profile-card"
          :style="{ '--accent': profile.accent }"
        >
          <div class="profile-header">
            <p class="profile-name">{{ profile.name }}</p>
            <h3>{{ profile.title }}</h3>
            <p>{{ profile.description }}</p>
          </div>
          <div class="dimension-bars">
            <div v-for="dimension in profile.dimensions" :key="`${profile.id}-${dimension.name}`" class="dimension-row">
              <span>{{ dimension.name }}</span>
              <div class="bar-track">
                <div class="bar-fill" :style="{ width: `${levelPercent(dimension.value)}%` }" />
              </div>
              <strong>{{ dimension.value }}</strong>
            </div>
          </div>
          <div class="sample">
            <p class="sample-label">Scenario</p>
            <p class="sample-prompt">{{ profile.sample.prompt }}</p>
            <p class="sample-label">Response style</p>
            <p class="sample-response">{{ profile.sample.response }}</p>
          </div>
          <a class="profile-link" :href="`${links.playground}?profile=${profile.id}`">Explore in Playground</a>
        </article>
      </div>
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
      <p>&copy; {{ new Date().getFullYear() }} FRNTR, LLC. All rights reserved.</p>
      <p class="built-in">Built in California</p>
    </footer>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import { withBase } from "vitepress";

const installCopied = ref(false);
const snippetCopied = ref(false);

const links = {
  home: withBase("/"),
  overview: withBase("/overview"),
  quickstart: withBase("/quickstart"),
  playground: withBase("/playground/"),
  guides: withBase("/guides/first-profile"),
  reference: withBase("/reference/cli"),
  api: withBase("/api/core")
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
  --surface: #0a0f1a;
  --surface-2: #111827;
  --surface-3: #111827;
  --border: #374151;
  --accent: #60a5fa;
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

.top-nav {
  width: min(1120px, calc(100% - 2rem));
  margin: 0 auto;
  padding-top: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border);
  padding-bottom: 16px;
}

.top-nav nav {
  display: flex;
  gap: 16px;
}

.top-nav a {
  color: var(--muted);
  text-decoration: none;
  font-weight: 600;
}

.top-nav a:hover {
  color: #e5e7eb;
}

.brand {
  color: #f8fafc !important;
  letter-spacing: 0.03em;
}

.github-link {
  color: var(--muted);
  display: flex;
  align-items: center;
}

.github-link:hover {
  color: #e5e7eb;
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
  margin: 8px 0 0;
  font-size: clamp(2.2rem, 6vw, 4.1rem);
  line-height: 1.02;
  color: #f8fafc;
  max-width: 24ch;
}

.subhead {
  margin: 16px 0 0;
  color: #d1d5db;
  font-size: 1.06rem;
  max-width: 56ch;
  line-height: 1.5;
}

.install-command {
  margin-top: 24px;
  border: 1px solid var(--border);
  background: #030712;
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
  margin-top: 12px;
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
  background: #030712;
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

.profile-grid {
  margin-top: 24px;
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.profile-card {
  border: 1px solid var(--border);
  border-radius: 0;
  background: var(--surface-2);
  overflow: hidden;
  display: grid;
  grid-template-rows: auto auto 1fr auto;
}

.profile-header {
  padding: 16px;
  background: var(--surface-2);
  border-bottom: 1px solid var(--border);
}

.profile-name {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--accent);
}

.profile-header h3 {
  margin: 4px 0;
  font-size: 1.1rem;
}

.profile-header p {
  margin: 0;
  color: #d1d5db;
  line-height: 1.45;
}

.dimension-bars {
  padding: 16px;
  display: grid;
  gap: 8px;
}

.dimension-row {
  display: grid;
  grid-template-columns: 88px 1fr auto;
  gap: 8px;
  align-items: center;
}

.dimension-row span {
  color: #9ca3af;
  font-size: 0.75rem;
}

.dimension-row strong {
  color: #e5e7eb;
  text-transform: capitalize;
  font-size: 0.7rem;
}

.bar-track {
  border-radius: 0;
  height: 8px;
  background: #1f2937;
}

.bar-fill {
  height: 100%;
  border-radius: 0;
  background: var(--accent);
}

.sample {
  padding: 0 16px 16px;
}

.sample-label {
  margin: 8px 0 4px;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #9ca3af;
}

.sample-prompt {
  margin: 0;
  color: #e5e7eb;
  font-weight: 600;
}

.sample-response {
  margin: 0;
  color: #d1d5db;
}

.profile-link {
  border-top: 1px solid var(--border);
  display: block;
  text-decoration: none;
  color: var(--accent);
  font-weight: 600;
  padding: 16px;
}

.profile-link:hover {
  color: #93c5fd;
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
  background: #2563eb;
  border-color: #2563eb;
  color: #f8fafc;
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
  background: #030712;
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

.site-footer .built-in {
  margin-top: 8px;
  font-size: 0.75rem;
  letter-spacing: 0.04em;
}

@media (max-width: 1024px) {
  .workflow-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .governance-grid,
  .profile-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .section {
    padding-top: 48px;
    padding-bottom: 48px;
  }

  .top-nav {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .top-nav nav {
    flex-wrap: wrap;
  }

  .hero h1 {
    max-width: 100%;
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

:global(html:not(.dark)) .top-nav a {
  color: #6b7280;
}

:global(html:not(.dark)) .top-nav a:hover {
  color: #0a0a0a;
}

:global(html:not(.dark)) .brand {
  color: #0a0a0a !important;
}

:global(html:not(.dark)) .hero h1 {
  color: #0a0a0a;
}

:global(html:not(.dark)) .subhead {
  color: #374151;
}

:global(html:not(.dark)) .eyebrow {
  color: #2563eb;
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
  border-color: #2563eb;
  color: #2563eb;
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

:global(html:not(.dark)) .profile-card {
  background: #ffffff;
  border-color: #d1d5db;
}

:global(html:not(.dark)) .profile-header {
  background: #f8f9fa;
}

:global(html:not(.dark)) .profile-header p,
:global(html:not(.dark)) .sample-response {
  color: #374151;
}

:global(html:not(.dark)) .sample-prompt,
:global(html:not(.dark)) .profile-header h3 {
  color: #0a0a0a;
}

:global(html:not(.dark)) .dimension-row strong {
  color: #1f2937;
}

:global(html:not(.dark)) .bar-track {
  background: #e5e7eb;
}

:global(html:not(.dark)) .bar-fill {
  background: #2563eb;
}

:global(html:not(.dark)) .profile-name {
  color: #2563eb;
}

:global(html:not(.dark)) .profile-link {
  color: #2563eb;
}

:global(html:not(.dark)) .integration-tabs button {
  background: #ffffff;
  border-color: #d1d5db;
}

:global(html:not(.dark)) .integration-tabs button.active {
  background: #2563eb;
  border-color: #2563eb;
  color: #f8fafc;
}

:global(html:not(.dark)) .integration-code pre {
  border-color: #374151;
}

:global(html:not(.dark)) .copy-snippet {
  background: #f8f9fa;
  border-color: #d1d5db;
  color: #2563eb;
}

:global(html:not(.dark)) .badge {
  border-color: #d1d5db;
}
</style>
