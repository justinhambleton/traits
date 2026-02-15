<template>
  <div class="landing-shell">
    <header class="top-nav">
      <a class="brand" :href="links.home">traits.dev</a>
      <nav>
        <a :href="links.playground">Playground</a>
        <a :href="links.schema">Schema</a>
        <a :href="links.guides">Guides</a>
        <a :href="links.api">API</a>
      </nav>
    </header>

    <section class="hero section">
      <div class="hero-copy">
        <p class="eyebrow">Voice and Behavioral Policy for Agents</p>
        <h1>Your AI agents sound generic. Fix that.</h1>
        <p class="subhead">
          Define voice and behavioral policy as YAML. Validate safety at build time. Compile
          model-aware system prompts.
        </p>
        <div class="hero-cta">
          <button class="install-command" type="button" @click="copyInstallCommand">
            <code>npm i @traits-dev/core</code>
            <span>{{ installCopied ? "Copied" : "Copy" }}</span>
          </button>
          <a class="playground-link" :href="links.playground">Try the Playground</a>
        </div>
      </div>
      <div class="hero-visual">
        <div class="visual-card yaml">
          <p class="label">YAML policy</p>
          <pre><code>voice:
  formality: low
  warmth: very-high
  directness: high
  humor:
    target: low
    style: dry</code></pre>
        </div>
        <div class="visual-arrow">compile</div>
        <div class="visual-card prompt">
          <p class="label">Compiled prompt</p>
          <pre><code>[VOICE TARGETS]
formality: low
warmth: very-high
directness: high
humor: low (dry)</code></pre>
        </div>
      </div>
    </section>

    <section class="workflow section">
      <h2>Define. Validate. Compile.</h2>
      <div class="workflow-grid">
        <article v-for="(step, index) in workflowSteps" :key="step.title" class="step-card">
          <p class="step-index">0{{ index + 1 }}</p>
          <h3>{{ step.title }}</h3>
          <pre><code>{{ step.code }}</code></pre>
        </article>
      </div>
    </section>

    <section class="profiles section">
      <h2>Built-in profile starters</h2>
      <p class="section-lede">
        Each profile starts from a different voice target and domain context. Use them as base
        policies in the playground.
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

    <section class="footer-cta section">
      <h2>Ship policy-driven prompts, not ad-hoc prompt strings.</h2>
      <div class="footer-actions">
        <button class="install-command" type="button" @click="copyInstallCommand">
          <code>npm i @traits-dev/core</code>
          <span>{{ installCopied ? "Copied" : "Copy" }}</span>
        </button>
        <a class="playground-link" :href="links.playground">Open Playground</a>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import { withBase } from "vitepress";

const installCopied = ref(false);
const snippetCopied = ref(false);

const links = {
  home: withBase("/"),
  playground: withBase("/playground/"),
  schema: withBase("/schema-reference"),
  guides: withBase("/guides/first-profile"),
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
  }
];

const profiles = [
  {
    id: "haven",
    name: "haven",
    title: "Healthcare Companion",
    accent: "#14b8a6",
    description: "High-empathy care navigation with explicit safety boundaries.",
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
    description: "Ownership-first support voice with high directness and controlled tone.",
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
    description: "Implementation-first engineering voice with terse, decisive guidance.",
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
    await navigator.clipboard.writeText("npm i @traits-dev/core");
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
  --ink: #e2e8f0;
  --muted: #94a3b8;
  --surface: #0a0f1a;
  --surface-2: #0f172a;
  --surface-3: #111827;
  --border: #22314b;
  --accent: #3b82f6;
  color: var(--ink);
  background: radial-gradient(circle at 10% 5%, #12213f 0%, #0a0f1a 34%, #090d16 100%);
  min-height: 100vh;
  padding-bottom: 5rem;
}

.section {
  width: min(1120px, calc(100% - 2rem));
  margin: 0 auto;
  padding-top: 5.2rem;
}

.top-nav {
  width: min(1120px, calc(100% - 2rem));
  margin: 0 auto;
  padding-top: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.top-nav nav {
  display: flex;
  gap: 1rem;
}

.top-nav a {
  color: var(--muted);
  text-decoration: none;
  font-weight: 600;
}

.top-nav a:hover {
  color: #e2e8f0;
}

.brand {
  color: #f8fafc !important;
  letter-spacing: 0.03em;
}

.hero {
  display: grid;
  gap: 1.5rem;
  grid-template-columns: 1.2fr 1fr;
}

.eyebrow {
  margin: 0;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 0.76rem;
  color: #93c5fd;
}

.hero h1 {
  margin: 0.8rem 0 0;
  font-size: clamp(2.2rem, 6vw, 4.1rem);
  line-height: 1.02;
  color: #f8fafc;
  max-width: 12ch;
}

.subhead {
  margin: 1rem 0 0;
  color: #cbd5e1;
  font-size: 1.06rem;
  max-width: 56ch;
  line-height: 1.5;
}

.hero-cta {
  margin-top: 1.4rem;
  display: flex;
  gap: 0.85rem;
  flex-wrap: wrap;
}

.install-command {
  border: 1px solid #27406b;
  background: #07101e;
  color: #dbeafe;
  border-radius: 0.75rem;
  padding: 0.72rem 0.9rem;
  display: flex;
  align-items: center;
  gap: 0.85rem;
  cursor: pointer;
  font-size: 0.88rem;
  font-family: var(--vp-font-family-mono);
}

.install-command span {
  color: #93c5fd;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.68rem;
}

.playground-link {
  border-radius: 0.75rem;
  border: 1px solid #3b82f6;
  background: #2563eb;
  color: #f8fafc;
  text-decoration: none;
  font-weight: 700;
  padding: 0.78rem 1rem;
}

.playground-link:hover {
  background: #1d4ed8;
}

.hero-visual {
  display: grid;
  align-content: center;
  gap: 0.7rem;
}

.visual-card {
  border: 1px solid #294066;
  border-radius: 0.85rem;
  padding: 0.8rem;
  background: #0b1323;
}

.visual-card .label {
  margin: 0;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #93c5fd;
}

.visual-card pre {
  margin: 0.55rem 0 0;
  font-size: 0.74rem;
  line-height: 1.4;
  color: #e2e8f0;
  white-space: pre-wrap;
}

.visual-arrow {
  color: #60a5fa;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  font-size: 0.75rem;
  padding-left: 0.4rem;
  animation: pulse 1.7s ease-in-out infinite;
}

.workflow h2,
.profiles h2,
.integrations h2,
.trust h2,
.footer-cta h2 {
  margin: 0;
  font-size: clamp(1.6rem, 2.2vw, 2.35rem);
}

.workflow-grid {
  margin-top: 1.4rem;
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.step-card {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 0.95rem;
  padding: 1rem;
  animation: fadeInUp 0.6s ease both;
}

.step-card:nth-child(2) {
  animation-delay: 0.15s;
}

.step-card:nth-child(3) {
  animation-delay: 0.3s;
}

.step-index {
  margin: 0;
  color: #60a5fa;
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.1em;
}

.step-card h3 {
  margin: 0.3rem 0 0.7rem;
}

.step-card pre {
  margin: 0;
  border-radius: 0.7rem;
  border: 1px solid #2b4166;
  background: #030916;
  padding: 0.75rem;
  min-height: 220px;
  overflow-x: auto;
  color: #dbeafe;
  font-size: 0.72rem;
  line-height: 1.45;
}

.section-lede {
  margin: 0.8rem 0 0;
  color: #cbd5e1;
  max-width: 72ch;
}

.profile-grid {
  margin-top: 1.4rem;
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.profile-card {
  border: 1px solid color-mix(in srgb, var(--accent) 35%, #2d3f5d);
  border-radius: 1rem;
  background: #0b1424;
  overflow: hidden;
  display: grid;
  grid-template-rows: auto auto 1fr auto;
}

.profile-header {
  padding: 1rem;
  background: linear-gradient(
    160deg,
    color-mix(in srgb, var(--accent) 20%, #0d172a),
    color-mix(in srgb, var(--accent) 8%, #0b1424)
  );
  border-bottom: 1px solid color-mix(in srgb, var(--accent) 26%, #364a67);
}

.profile-name {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.72rem;
  font-weight: 700;
  color: color-mix(in srgb, var(--accent) 70%, #dbeafe);
}

.profile-header h3 {
  margin: 0.35rem 0;
  font-size: 1.1rem;
}

.profile-header p {
  margin: 0;
  color: #c7d2e3;
  line-height: 1.45;
}

.dimension-bars {
  padding: 0.9rem 1rem;
  display: grid;
  gap: 0.5rem;
}

.dimension-row {
  display: grid;
  grid-template-columns: 88px 1fr auto;
  gap: 0.45rem;
  align-items: center;
}

.dimension-row span {
  color: #94a3b8;
  font-size: 0.75rem;
}

.dimension-row strong {
  color: #dbeafe;
  text-transform: capitalize;
  font-size: 0.7rem;
}

.bar-track {
  border-radius: 999px;
  height: 8px;
  background: #1f2a3d;
}

.bar-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, color-mix(in srgb, var(--accent) 78%, #f8fafc), var(--accent));
}

.sample {
  padding: 0 1rem 1rem;
}

.sample-label {
  margin: 0.6rem 0 0.2rem;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #93a8c6;
}

.sample-prompt {
  margin: 0;
  color: #e2e8f0;
  font-weight: 600;
}

.sample-response {
  margin: 0;
  color: #c7d2e2;
}

.profile-link {
  border-top: 1px solid #243652;
  display: block;
  text-decoration: none;
  color: #bfdbfe;
  font-weight: 600;
  padding: 0.8rem 1rem;
}

.profile-link:hover {
  color: #eff6ff;
}

.integration-tabs {
  margin-top: 1.1rem;
  display: flex;
  gap: 0.55rem;
}

.integration-tabs button {
  border: 1px solid #29406a;
  border-radius: 999px;
  padding: 0.45rem 0.8rem;
  background: #0b1526;
  color: #9fb6d7;
  font-weight: 700;
  cursor: pointer;
}

.integration-tabs button.active {
  background: #1d4ed8;
  border-color: #3b82f6;
  color: #f8fafc;
}

.integration-code {
  position: relative;
  margin-top: 0.8rem;
}

.copy-snippet {
  position: absolute;
  top: 0.7rem;
  right: 0.7rem;
  border: 1px solid #335178;
  border-radius: 0.5rem;
  background: #15233c;
  color: #bfdbfe;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
  padding: 0.35rem 0.5rem;
  cursor: pointer;
}

.integration-code pre {
  margin: 0;
  border-radius: 0.9rem;
  border: 1px solid #2b4168;
  background: #030b19;
  color: #dbeafe;
  padding: 1rem;
  overflow-x: auto;
  min-height: 210px;
}

.badge-row {
  margin-top: 1rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
}

.badge {
  display: inline-flex;
  border: 1px solid #263a57;
  border-radius: 999px;
  overflow: hidden;
}

.badge img {
  display: block;
  height: 28px;
}

.footer-cta {
  margin-top: 1.4rem;
  padding-bottom: 2rem;
}

.footer-actions {
  margin-top: 1rem;
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 0.5;
  }
  50% {
    opacity: 1;
  }
}

@keyframes fadeInUp {
  from {
    transform: translateY(8px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@media (max-width: 1024px) {
  .hero {
    grid-template-columns: 1fr;
  }

  .workflow-grid,
  .profile-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .section {
    padding-top: 4.1rem;
  }

  .top-nav {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.6rem;
  }

  .top-nav nav {
    flex-wrap: wrap;
  }

  .hero h1 {
    max-width: 100%;
  }
}

:global(html:not(.dark)) .landing-shell {
  --ink: #10233e;
  --muted: #475569;
  --surface: #eef4fb;
  --surface-2: #f7fbff;
  --surface-3: #ffffff;
  --border: #d1dfef;
  background: linear-gradient(180deg, #eef5ff 0%, #f8fbff 32%, #ffffff 100%);
}

:global(html:not(.dark)) .top-nav a {
  color: #475569;
}

:global(html:not(.dark)) .top-nav a:hover {
  color: #0f172a;
}

:global(html:not(.dark)) .brand {
  color: #0f172a !important;
}

:global(html:not(.dark)) .hero h1 {
  color: #0f172a;
}

:global(html:not(.dark)) .subhead {
  color: #1f334d;
}

:global(html:not(.dark)) .install-command {
  background: #0f172a;
  border-color: #1e293b;
  color: #e2e8f0;
}

:global(html:not(.dark)) .playground-link {
  color: #f8fafc;
}

:global(html:not(.dark)) .visual-card {
  background: #0f172a;
  border-color: #1f2f47;
}

:global(html:not(.dark)) .workflow h2,
:global(html:not(.dark)) .profiles h2,
:global(html:not(.dark)) .integrations h2,
:global(html:not(.dark)) .trust h2,
:global(html:not(.dark)) .footer-cta h2 {
  color: #0f172a;
}

:global(html:not(.dark)) .section-lede {
  color: #334155;
}

:global(html:not(.dark)) .step-card {
  background: #f8fbff;
  border-color: #d5e2f3;
}

:global(html:not(.dark)) .step-card pre {
  border-color: #294066;
}

:global(html:not(.dark)) .profile-card {
  background: #ffffff;
}

:global(html:not(.dark)) .profile-header p,
:global(html:not(.dark)) .sample-response {
  color: #334155;
}

:global(html:not(.dark)) .sample-prompt,
:global(html:not(.dark)) .profile-header h3 {
  color: #0f172a;
}

:global(html:not(.dark)) .dimension-row strong {
  color: #1e293b;
}

:global(html:not(.dark)) .integration-tabs button {
  background: #ffffff;
}

:global(html:not(.dark)) .integration-code pre {
  border-color: #2b4168;
}
</style>
