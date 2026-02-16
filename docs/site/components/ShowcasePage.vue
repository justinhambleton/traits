<template>
  <div class="showcase-shell">
    <section class="showcase-header">
      <p class="eyebrow">traits.dev static comparison showcase</p>
      <h2>Pick a scenario and compare haven, resolve, and architect side by side</h2>
      <p class="lede">
        These responses are sourced from live generation runs and rendered statically for docs.
        No backend, no runtime API calls.
      </p>
      <p class="showcase-disclaimer">
        Responses are voice demonstrations. In production, tool-grounding constraints are
        required before treating action claims as completed operations.
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
  --ink: #0a0a0a;
  --muted: #6b7280;
  display: grid;
  gap: 16px;
  color: var(--ink);
}

.showcase-header {
  border-radius: 0;
  background: #f8f9fa;
  border: 1px solid #d1d5db;
  padding: 16px;
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.72rem;
  color: #2563eb;
  margin: 0;
}

.showcase-header h2 {
  margin: 4px 0 8px;
  line-height: 1.2;
  font-size: clamp(1.15rem, 1rem + 1vw, 1.9rem);
}

.lede {
  margin: 0;
  color: var(--muted);
}

.showcase-disclaimer {
  margin: 8px 0 0;
  border: 1px solid #f8d58c;
  background: #fff8e8;
  color: #92400e;
  border-radius: 0;
  padding: 8px;
  font-size: 0.84rem;
}

.scenario-picker {
  border: 1px solid #d1d5db;
  border-radius: 0;
  padding: 16px;
  background: #f8f9fa;
}

.picker-label {
  margin: 0 0 8px;
  font-size: 0.9rem;
  font-weight: 700;
}

.scenario-buttons {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.scenario-button {
  border: 1px solid #d1d5db;
  border-radius: 0;
  background: #fff;
  text-align: left;
  padding: 8px;
  cursor: pointer;
  display: grid;
  gap: 4px;
}

.scenario-button:hover {
  border-color: #2563eb;
}

.scenario-button.active {
  border-color: #2563eb;
  background: #eff6ff;
}

.scenario-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: #0a0a0a;
  text-transform: capitalize;
}

.scenario-meta {
  font-size: 0.75rem;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.prompt-panel {
  border: 1px solid #d1d5db;
  border-radius: 0;
  padding: 16px;
  background: #fff;
}

.prompt-label {
  margin: 0;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #6b7280;
}

.prompt-quote {
  margin: 8px 0;
  padding: 8px 16px;
  border-left: 3px solid #2563eb;
  border-radius: 0;
  background: #f8f9fa;
  color: #0a0a0a;
}

.prompt-expectation {
  margin: 0;
  color: #374151;
  font-size: 0.93rem;
}

.comparison-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.profile-card {
  border: 1px solid #d1d5db;
  border-radius: 0;
  overflow: hidden;
  background: #fff;
  display: grid;
  grid-template-rows: auto 1fr auto;
  min-height: 100%;
}

.profile-head {
  padding: 16px;
  background: #f8f9fa;
  border-bottom: 1px solid #d1d5db;
}

.profile-slug {
  margin: 0;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #2563eb;
  font-weight: 700;
}

.profile-head h3 {
  margin: 4px 0;
  font-size: 1rem;
  line-height: 1.25;
}

.profile-summary {
  margin: 0;
  color: #374151;
  font-size: 0.82rem;
}

.profile-delta {
  margin: 8px 0 0;
  color: #6b7280;
  font-size: 0.78rem;
}

.response-wrap {
  padding: 16px;
  display: grid;
  gap: 8px;
}

.response-label {
  margin: 0;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: #6b7280;
}

.response-text {
  margin: 0;
  white-space: pre-wrap;
  color: #0a0a0a;
  font-size: 0.9rem;
  line-height: 1.4;
}

.response-score {
  margin: 4px 0 0;
  font-size: 0.78rem;
  font-weight: 700;
  width: fit-content;
  padding: 2px 8px;
  border-radius: 0;
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
  color: #6b7280;
  background: #e5e7eb;
}

.prompt-details {
  border-top: 1px solid #d1d5db;
  padding: 16px;
}

.prompt-details summary {
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 600;
  color: #374151;
}

.prompt-details pre {
  margin: 8px 0 0;
  max-height: 240px;
  overflow: auto;
  border: 1px solid #374151;
  border-radius: 0;
  padding: 16px;
  font-size: 0.72rem;
  line-height: 1.35;
  background: #0a0a0a;
  color: #e5e7eb;
}

.showcase-source {
  font-size: 0.78rem;
  color: #6b7280;
}

.showcase-source p {
  margin: 4px 0;
}

:global(.dark) .showcase-shell {
  --ink: #e5e7eb;
  --muted: #9ca3af;
}

:global(.dark) .showcase-header {
  background: #111827;
  border-color: #374151;
}

:global(.dark) .eyebrow {
  color: #60a5fa;
}

:global(.dark) .scenario-picker {
  border-color: #374151;
  background: #111827;
}

:global(.dark) .scenario-button {
  border-color: #374151;
  background: #0a0f1a;
}

:global(.dark) .scenario-button:hover {
  border-color: #60a5fa;
}

:global(.dark) .scenario-button.active {
  border-color: #60a5fa;
  background: #1e3a5f;
}

:global(.dark) .scenario-name {
  color: #e5e7eb;
}

:global(.dark) .scenario-meta {
  color: #9ca3af;
}

:global(.dark) .prompt-panel {
  border-color: #374151;
  background: #111827;
}

:global(.dark) .prompt-label {
  color: #9ca3af;
}

:global(.dark) .prompt-quote {
  border-left-color: #60a5fa;
  background: #0a0f1a;
  color: #e5e7eb;
}

:global(.dark) .showcase-disclaimer {
  border-color: #6b4c19;
  background: #2b210f;
  color: #f7d8a8;
}

:global(.dark) .prompt-expectation {
  color: #d1d5db;
}

:global(.dark) .profile-card {
  border-color: #374151;
  background: #111827;
}

:global(.dark) .profile-head {
  background: #0a0f1a;
  border-bottom-color: #374151;
}

:global(.dark) .profile-slug {
  color: #60a5fa;
}

:global(.dark) .profile-summary {
  color: #d1d5db;
}

:global(.dark) .profile-delta {
  color: #9ca3af;
}

:global(.dark) .response-label {
  color: #9ca3af;
}

:global(.dark) .response-text {
  color: #e5e7eb;
}

:global(.dark) .prompt-details {
  border-top-color: #374151;
}

:global(.dark) .prompt-details summary {
  color: #d1d5db;
}

:global(.dark) .prompt-details pre {
  border-color: #374151;
  background: #030712;
  color: #e5e7eb;
}

:global(.dark) .showcase-source {
  color: #9ca3af;
}

@media (max-width: 980px) {
  .comparison-grid {
    grid-template-columns: 1fr;
  }
}
</style>
