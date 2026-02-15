<template>
  <div class="showcase-shell">
    <section class="showcase-header">
      <p class="eyebrow">traits.dev static comparison showcase</p>
      <h2>Pick a scenario and compare haven, resolve, and architect side by side</h2>
      <p class="lede">
        These responses are sourced from live generation runs and rendered statically for docs.
        No backend, no runtime API calls.
      </p>
    </section>

    <section class="scenario-picker">
      <p class="picker-label">Scenarios</p>
      <div class="scenario-buttons">
        <button
          v-for="scenario in showcase.scenarios"
          :key="scenario.id"
          class="scenario-button"
          :class="{ active: selectedScenarioId === scenario.id }"
          @click="selectedScenarioId = scenario.id"
        >
          <span class="scenario-name">{{ scenarioLabel(scenario.id) }}</span>
          <span class="scenario-meta">{{ scenario.category }}</span>
        </button>
      </div>
    </section>

    <section class="prompt-panel">
      <p class="prompt-label">Shared user prompt</p>
      <blockquote class="prompt-quote">{{ selectedScenario.prompt }}</blockquote>
      <p class="prompt-expectation">
        <strong>Expected behavior:</strong> {{ selectedScenario.expectedBehavior }}
      </p>
    </section>

    <section class="comparison-grid">
      <article
        v-for="profile in profiles"
        :key="profile.slug"
        class="profile-card"
        :style="{ '--accent': profile.accent }"
      >
        <header class="profile-head">
          <p class="profile-slug">{{ profile.label }}</p>
          <h3>{{ profile.title }}</h3>
          <p class="profile-summary">{{ profile.description }}</p>
          <p class="profile-delta">
            Tier 1 compiled-vs-generic delta:
            <strong>+{{ Number(profile.tier1Delta).toFixed(2) }}</strong>
          </p>
        </header>

        <div class="response-wrap">
          <p class="response-label">Compiled response</p>
          <p class="response-text">{{ sampleFor(profile, selectedScenario.id)?.response }}</p>
          <p class="response-score" :class="scoreClass(sampleFor(profile, selectedScenario.id)?.tier1Score)">
            Tier 1 score: {{ sampleFor(profile, selectedScenario.id)?.tier1Score ?? "n/a" }}
          </p>
        </div>

        <details class="prompt-details">
          <summary>View compiled system prompt</summary>
          <pre>{{ profile.compiledSystemPrompt }}</pre>
        </details>
      </article>
    </section>

    <section class="showcase-source">
      <p>
        Source artifacts:
        <code>{{ showcase.sourceRuns.haven }}</code>,
        <code>{{ showcase.sourceRuns.resolve }}</code>,
        <code>{{ showcase.sourceRuns.architect }}</code>
      </p>
      <p>Generated: <code>{{ showcase.generatedAt }}</code></p>
    </section>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import showcase from "../data/showcase.json";

const selectedScenarioId = ref(showcase.scenarios[0]?.id ?? "");

const scenariosById = new Map(showcase.scenarios.map((scenario) => [scenario.id, scenario]));
const selectedScenario = computed(
  () => scenariosById.get(selectedScenarioId.value) ?? showcase.scenarios[0]
);
const profiles = computed(() =>
  showcase.profileOrder.map((slug) => ({ slug, ...showcase.profiles[slug] }))
);

function sampleFor(profile, scenarioId) {
  return profile.samples.find((sample) => sample.id === scenarioId) ?? null;
}

function scenarioLabel(id) {
  return id.replaceAll("-", " ");
}

function scoreClass(score) {
  if (score == null) return "score-muted";
  if (score >= 0.85) return "score-strong";
  if (score >= 0.7) return "score-good";
  return "score-base";
}
</script>

<style scoped>
.showcase-shell {
  --bg-soft: linear-gradient(145deg, #f7f9fb 0%, #eef3f8 100%);
  --ink: #13233a;
  --muted: #4a5f7c;
  display: grid;
  gap: 1.25rem;
  color: var(--ink);
}

.showcase-header {
  border-radius: 1rem;
  background: radial-gradient(circle at top right, #dbeafe 0%, #f8fafc 48%, #f1f5f9 100%);
  border: 1px solid #d1e0f5;
  padding: 1.1rem 1.1rem 1rem;
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.72rem;
  color: #1d4ed8;
  margin: 0;
}

.showcase-header h2 {
  margin: 0.3rem 0 0.5rem;
  line-height: 1.2;
  font-size: clamp(1.15rem, 1rem + 1vw, 1.9rem);
}

.lede {
  margin: 0;
  color: var(--muted);
}

.scenario-picker {
  border: 1px solid #dae2ee;
  border-radius: 0.9rem;
  padding: 0.9rem;
  background: var(--bg-soft);
}

.picker-label {
  margin: 0 0 0.65rem;
  font-size: 0.9rem;
  font-weight: 700;
}

.scenario-buttons {
  display: grid;
  gap: 0.55rem;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.scenario-button {
  border: 1px solid #cfdced;
  border-radius: 0.75rem;
  background: #fff;
  text-align: left;
  padding: 0.6rem 0.7rem;
  cursor: pointer;
  display: grid;
  gap: 0.25rem;
  transition: all 0.18s ease;
}

.scenario-button:hover {
  border-color: #8bb2e8;
  transform: translateY(-1px);
}

.scenario-button.active {
  border-color: #2563eb;
  background: linear-gradient(180deg, #eff6ff 0%, #f8fbff 100%);
  box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.15) inset;
}

.scenario-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: #0f172a;
  text-transform: capitalize;
}

.scenario-meta {
  font-size: 0.75rem;
  color: #556987;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.prompt-panel {
  border: 1px solid #d7e2ef;
  border-radius: 0.9rem;
  padding: 0.95rem;
  background: #fff;
}

.prompt-label {
  margin: 0;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #64748b;
}

.prompt-quote {
  margin: 0.55rem 0 0.4rem;
  padding: 0.65rem 0.8rem;
  border-left: 3px solid #2563eb;
  border-radius: 0 0.4rem 0.4rem 0;
  background: #f8fbff;
  color: #0f172a;
}

.prompt-expectation {
  margin: 0;
  color: #334155;
  font-size: 0.93rem;
}

.comparison-grid {
  display: grid;
  gap: 0.9rem;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.profile-card {
  border: 1px solid color-mix(in srgb, var(--accent) 35%, #ced8e6);
  border-radius: 0.95rem;
  overflow: hidden;
  background: #fff;
  display: grid;
  grid-template-rows: auto 1fr auto;
  min-height: 100%;
}

.profile-head {
  padding: 0.85rem;
  background: linear-gradient(
    160deg,
    color-mix(in srgb, var(--accent) 18%, #f8fafc),
    color-mix(in srgb, var(--accent) 6%, #ffffff)
  );
  border-bottom: 1px solid color-mix(in srgb, var(--accent) 22%, #d7e3f2);
}

.profile-slug {
  margin: 0;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: color-mix(in srgb, var(--accent) 72%, #1e293b);
  font-weight: 700;
}

.profile-head h3 {
  margin: 0.3rem 0 0.35rem;
  font-size: 1rem;
  line-height: 1.25;
}

.profile-summary {
  margin: 0;
  color: #334155;
  font-size: 0.82rem;
}

.profile-delta {
  margin: 0.5rem 0 0;
  color: #475569;
  font-size: 0.78rem;
}

.response-wrap {
  padding: 0.85rem;
  display: grid;
  gap: 0.45rem;
}

.response-label {
  margin: 0;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: #64748b;
}

.response-text {
  margin: 0;
  white-space: pre-wrap;
  color: #0f172a;
  font-size: 0.9rem;
  line-height: 1.4;
}

.response-score {
  margin: 0.25rem 0 0;
  font-size: 0.78rem;
  font-weight: 700;
  width: fit-content;
  padding: 0.22rem 0.5rem;
  border-radius: 999px;
}

.score-strong {
  color: #14532d;
  background: #dcfce7;
}

.score-good {
  color: #1e3a8a;
  background: #dbeafe;
}

.score-base {
  color: #6b21a8;
  background: #f3e8ff;
}

.score-muted {
  color: #475569;
  background: #e2e8f0;
}

.prompt-details {
  border-top: 1px solid #e2e8f0;
  padding: 0.7rem 0.85rem 0.85rem;
}

.prompt-details summary {
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 600;
  color: #334155;
}

.prompt-details pre {
  margin: 0.6rem 0 0;
  max-height: 240px;
  overflow: auto;
  border: 1px solid #dbe3f1;
  border-radius: 0.6rem;
  padding: 0.7rem;
  font-size: 0.72rem;
  line-height: 1.35;
  background: #0f172a;
  color: #dbeafe;
}

.showcase-source {
  font-size: 0.78rem;
  color: #64748b;
}

.showcase-source p {
  margin: 0.2rem 0;
}

:global(.dark) .showcase-shell {
  --bg-soft: linear-gradient(145deg, #10192b 0%, #0d1626 100%);
  --ink: #dbe7fb;
  --muted: #a2b4d2;
}

:global(.dark) .showcase-header {
  background: radial-gradient(circle at top right, #1b2d4a 0%, #0f1828 50%, #0c1422 100%);
  border-color: #2b3f60;
}

:global(.dark) .eyebrow {
  color: #7ab3ff;
}

:global(.dark) .scenario-picker {
  border-color: #31445f;
}

:global(.dark) .scenario-button {
  border-color: #3a4d69;
  background: #0d1626;
}

:global(.dark) .scenario-button:hover {
  border-color: #7aa8ea;
}

:global(.dark) .scenario-button.active {
  border-color: #60a5fa;
  background: linear-gradient(180deg, #15263f 0%, #122339 100%);
  box-shadow: 0 0 0 1px rgba(96, 165, 250, 0.24) inset;
}

:global(.dark) .scenario-name {
  color: #e5edff;
}

:global(.dark) .scenario-meta {
  color: #9cb0d1;
}

:global(.dark) .prompt-panel {
  border-color: #334a68;
  background: #0e1727;
}

:global(.dark) .prompt-label {
  color: #9ab0d3;
}

:global(.dark) .prompt-quote {
  border-left-color: #60a5fa;
  background: #13233a;
  color: #e5edff;
}

:global(.dark) .prompt-expectation {
  color: #c7d5ec;
}

:global(.dark) .profile-card {
  border-color: color-mix(in srgb, var(--accent) 40%, #334a68);
  background: #0b1422;
}

:global(.dark) .profile-head {
  background: linear-gradient(
    160deg,
    color-mix(in srgb, var(--accent) 18%, #101b2d),
    color-mix(in srgb, var(--accent) 10%, #0b1422)
  );
  border-bottom-color: color-mix(in srgb, var(--accent) 28%, #334b68);
}

:global(.dark) .profile-summary {
  color: #c4d4ed;
}

:global(.dark) .profile-delta {
  color: #adc0df;
}

:global(.dark) .response-label {
  color: #9ab0d3;
}

:global(.dark) .response-text {
  color: #e5edff;
}

:global(.dark) .prompt-details {
  border-top-color: #334a68;
}

:global(.dark) .prompt-details summary {
  color: #c7d5ec;
}

:global(.dark) .prompt-details pre {
  border-color: #365172;
  background: #030b19;
  color: #dbeafe;
}

:global(.dark) .showcase-source {
  color: #a2b4d2;
}

@media (max-width: 980px) {
  .comparison-grid {
    grid-template-columns: 1fr;
  }
}
</style>
