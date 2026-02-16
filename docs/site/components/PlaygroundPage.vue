<template>
  <div class="playground-shell">
    <section class="playground-header">
      <p class="eyebrow">Interactive Voice Playground</p>
      <h1>Configure voice policy and inspect compiled prompt output instantly</h1>
      <p>
        The playground uses precomputed profile responses and in-browser compilation. Use it to
        see how voice targets and policy changes alter compiled prompt guidance before integrating.
      </p>
    </section>

    <section class="playground-grid">
      <article class="panel config">
        <h2>Configuration</h2>

        <label class="field">
          <span>Profile</span>
          <select v-model="selectedProfileId">
            <option v-for="profile in orderedProfiles" :key="profile.id" :value="profile.id">
              {{ profile.label }} - {{ profile.title }}
            </option>
          </select>
        </label>

        <div class="slider-list">
          <div v-for="dimension in dimensions" :key="dimension.id" class="slider-field">
            <div class="slider-meta">
              <strong>{{ dimension.label }}</strong>
              <span>{{ voice[dimension.id] }}</span>
            </div>
            <input
              :value="levelToIndex(voice[dimension.id])"
              min="0"
              max="4"
              step="1"
              type="range"
              @input="onSliderInput(dimension.id, $event)"
            />
            <div class="tick-row">
              <span v-for="level in levels" :key="`${dimension.id}-${level}`">{{ level }}</span>
            </div>
          </div>
        </div>

        <label v-if="voice.humor !== 'very-low'" class="field">
          <span>Humor Style</span>
          <select v-model="humorStyle">
            <option v-for="style in humorStyles" :key="style" :value="style">{{ style }}</option>
          </select>
        </label>

        <label class="field">
          <span>Scenario</span>
          <select v-model="selectedScenarioId">
            <option v-for="scenario in activeScenarios" :key="scenario.id" :value="scenario.id">
              {{ scenario.id }} ({{ scenario.category }})
            </option>
          </select>
        </label>

        <div class="yaml-block">
          <p>YAML source (read-only)</p>
          <pre><code>{{ yamlSource }}</code></pre>
        </div>
      </article>

      <article class="panel compiled">
        <h2>Compiled Output</h2>
        <p class="compiled-note">
          Voice target changes are reflected in the compiled prompt block below.
        </p>
        <p class="validation-summary" :class="{ error: validationErrors.length > 0 }">
          Validation:
          <strong>{{ validationErrors.length }}</strong> error(s),
          <strong>{{ validationWarnings.length }}</strong> warning(s)
        </p>
        <ul v-if="validationErrors.length + validationWarnings.length > 0" class="validation-list">
          <li
            v-for="diagnostic in [...validationErrors, ...validationWarnings]"
            :key="`${diagnostic.code}-${diagnostic.location ?? ''}-${diagnostic.message}`"
            :class="diagnostic.severity"
          >
            <code>{{ diagnostic.code }}</code>
            <span>{{ diagnostic.message }}</span>
          </li>
        </ul>
        <pre><code>{{ compiledPrompt }}</code></pre>
      </article>
    </section>

    <section class="panel response">
      <div class="response-head">
        <div>
          <h2>Response Preview</h2>
          <p>{{ activeScenario.prompt }}</p>
        </div>
        <div class="score-pill">
          <span>Tier 1 Score</span>
          <strong>{{ activeTier1Score != null ? activeTier1Score.toFixed(2) : "n/a" }}</strong>
        </div>
      </div>

      <p class="expected"><strong>Expected behavior:</strong> {{ activeScenario.expectedBehavior }}</p>

      <div class="response-box">
        <p v-if="byokLoading" class="no-response">Generating...</p>
        <p v-else-if="byokError" class="response-error">{{ byokError }}</p>
        <template v-else-if="displayedResponseSource !== 'none'">
          <span v-if="displayedResponseSource === 'live'" class="live-badge">Live response</span>
          <p>{{ typedResponse }}</p>
        </template>
        <p v-else class="no-response">
          No precomputed response for this custom slider configuration yet. Reset to the profile
          default voice to view the recorded sample for this scenario.
        </p>
      </div>

      <details class="byok">
        <summary>Try with your API key (stored locally)</summary>
        <p>
          BYOK wiring is intentionally opt-in. Keys are saved in localStorage and never sent to a
          traits.dev backend.
        </p>
        <label class="field">
          <span>Provider</span>
          <select v-model="byokProvider">
            <option value="openai">OpenAI</option>
          </select>
        </label>
        <label class="field">
          <span>API key</span>
          <input
            v-model="byokKey"
            type="password"
            placeholder="sk-..."
            @change="persistByokKey"
          />
        </label>
        <div class="byok-actions">
          <button type="button" :disabled="!canGenerateLiveResponse" @click="generateLiveResponse">
            Generate Live Response
          </button>
          <span v-if="byokLoading" class="byok-status">Generating...</span>
        </div>
      </details>
    </section>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  compileResolvedProfile,
  evaluateTier1Response,
  validateResolvedProfile
} from "../../../packages/core/dist/index.js";
import playgroundData from "../data/playground.json";

const dimensions = [
  { id: "formality", label: "Formality" },
  { id: "warmth", label: "Warmth" },
  { id: "verbosity", label: "Verbosity" },
  { id: "directness", label: "Directness" },
  { id: "empathy", label: "Empathy" },
  { id: "humor", label: "Humor" }
];

const levels = playgroundData.levels;
const humorStyles = ["none", "dry", "subtle-wit", "playful"];

const orderedProfiles = playgroundData.profileOrder.map((id) => ({
  id,
  ...playgroundData.profiles[id]
}));
const profileMap = new Map(orderedProfiles.map((profile) => [profile.id, profile]));

const selectedProfileId = ref(orderedProfiles[0]?.id ?? "haven");
const selectedScenarioId = ref("");
const voice = ref({
  formality: "medium",
  warmth: "medium",
  verbosity: "medium",
  directness: "medium",
  empathy: "medium",
  humor: "low"
});
const humorStyle = ref("none");

const byokProvider = ref("openai");
const byokKey = ref("");
const byokResponse = ref("");
const byokLoading = ref(false);
const byokError = ref("");
const byokTier1Score = ref(null);
const byokRequestId = ref(0);

const activeProfile = computed(
  () => profileMap.get(selectedProfileId.value) ?? orderedProfiles[0]
);
const activeScenarios = computed(() => activeProfile.value.scenarios ?? []);
const activeScenario = computed(
  () =>
    activeScenarios.value.find((scenario) => scenario.id === selectedScenarioId.value) ??
    activeScenarios.value[0] ?? {
      id: "",
      prompt: "",
      expectedBehavior: "",
      response: "",
      tier1Score: null
    }
);

const responseTimer = ref(null);
const compileTimer = ref(null);
const typedResponse = ref("");
const compiledPrompt = ref("");
const validationWarnings = ref([]);
const validationErrors = ref([]);
const compilationReady = ref(false);

function voiceSignature(value, style) {
  return [
    value.formality,
    value.warmth,
    value.verbosity,
    value.directness,
    value.empathy,
    value.humor,
    style
  ].join("|");
}

const defaultVoiceSignature = computed(() =>
  voiceSignature(activeProfile.value.baseVoice, activeProfile.value.baseHumorStyle)
);
const activeVoiceSignature = computed(() => voiceSignature(voice.value, humorStyle.value));
const isDefaultVoiceConfig = computed(
  () => activeVoiceSignature.value === defaultVoiceSignature.value
);
const displayedResponseSource = computed(() => {
  if (byokResponse.value) return "live";
  if (isDefaultVoiceConfig.value && activeScenario.value.response) return "precomputed";
  return "none";
});
const displayedResponseText = computed(() => {
  if (displayedResponseSource.value === "live") return String(byokResponse.value ?? "");
  if (displayedResponseSource.value === "precomputed")
    return String(activeScenario.value.response ?? "");
  return "";
});
const activeTier1Score = computed(() => {
  if (byokLoading.value || byokError.value) return null;
  if (byokResponse.value) return byokTier1Score.value;
  return isDefaultVoiceConfig.value ? activeScenario.value.tier1Score : null;
});
const hasByokKey = computed(() => byokKey.value.trim().length > 0);
const hasSelectedScenario = computed(
  () => Boolean(activeScenario.value.id) && Boolean(activeScenario.value.prompt)
);
const canGenerateLiveResponse = computed(
  () =>
    byokProvider.value === "openai" &&
    !byokLoading.value &&
    hasByokKey.value &&
    hasSelectedScenario.value &&
    compilationReady.value &&
    compiledPrompt.value.trim().length > 0
);

function replaceVoiceYaml(template, voiceTargets, style) {
  const lines = String(template ?? "").split("\n");
  const start = lines.findIndex((line) => line.trim() === "voice:");
  if (start === -1) return template;

  let end = start + 1;
  while (end < lines.length) {
    const line = lines[end];
    if (line.trim() === "") {
      end += 1;
      continue;
    }
    if (!line.startsWith("  ")) break;
    end += 1;
  }

  const replacement = [
    "voice:",
    `  formality: "${voiceTargets.formality}"`,
    `  warmth: "${voiceTargets.warmth}"`,
    `  verbosity: "${voiceTargets.verbosity}"`,
    `  directness: "${voiceTargets.directness}"`,
    `  empathy: "${voiceTargets.empathy}"`,
    "  humor:",
    `    target: "${voiceTargets.humor}"`,
    `    style: "${voiceTargets.humor === "very-low" ? "none" : style}"`
  ];

  return [...lines.slice(0, start), ...replacement, ...lines.slice(end)].join("\n");
}

const yamlSource = computed(() =>
  replaceVoiceYaml(activeProfile.value.yamlTemplate, voice.value, humorStyle.value)
);

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function applyVoiceTarget(existing, nextLevel) {
  if (existing && typeof existing === "object" && !Array.isArray(existing)) {
    return { ...existing, target: nextLevel };
  }
  return nextLevel;
}

function buildMutableProfile() {
  const profile = cloneJson(activeProfile.value.profile);
  profile.voice = profile.voice ?? {};
  profile.voice.formality = applyVoiceTarget(profile.voice.formality, voice.value.formality);
  profile.voice.warmth = applyVoiceTarget(profile.voice.warmth, voice.value.warmth);
  profile.voice.verbosity = applyVoiceTarget(profile.voice.verbosity, voice.value.verbosity);
  profile.voice.directness = applyVoiceTarget(profile.voice.directness, voice.value.directness);
  profile.voice.empathy = applyVoiceTarget(profile.voice.empathy, voice.value.empathy);
  const nextHumor = applyVoiceTarget(profile.voice.humor, voice.value.humor);
  profile.voice.humor =
    nextHumor && typeof nextHumor === "object" && !Array.isArray(nextHumor)
      ? { ...nextHumor, style: voice.value.humor === "very-low" ? "none" : humorStyle.value }
      : nextHumor;
  return profile;
}

function clearByokState() {
  byokRequestId.value += 1;
  byokLoading.value = false;
  byokResponse.value = "";
  byokError.value = "";
  byokTier1Score.value = null;
}

function runCompilationNow() {
  try {
    const profile = buildMutableProfile();
    const compiled = compileResolvedProfile(profile, {
      model: "gpt-4o"
    });
    const validation = validateResolvedProfile(profile, { strict: false });
    compiledPrompt.value = compiled.text;
    validationWarnings.value = validation.warnings ?? [];
    validationErrors.value = validation.errors ?? [];
    compilationReady.value = true;
  } catch (error) {
    compiledPrompt.value = `Compilation error: ${error instanceof Error ? error.message : String(error)}`;
    validationWarnings.value = [];
    validationErrors.value = [
      {
        code: "E_PLAYGROUND_COMPILE",
        message: error instanceof Error ? error.message : String(error),
        location: "playground",
        severity: "error"
      }
    ];
    compilationReady.value = false;
  }
}

function scheduleCompilation() {
  if (typeof window === "undefined") return;
  if (compileTimer.value) {
    clearTimeout(compileTimer.value);
  }
  compileTimer.value = setTimeout(() => {
    compileTimer.value = null;
    runCompilationNow();
  }, 50);
}

function resetProfileState(profile) {
  voice.value = { ...profile.baseVoice };
  humorStyle.value = profile.baseHumorStyle ?? "none";
  selectedScenarioId.value = profile.defaultScenarioId ?? profile.scenarios?.[0]?.id ?? "";
  compiledPrompt.value = String(profile.compiledPrompt ?? "");
  compilationReady.value = compiledPrompt.value.trim().length > 0;
  validationWarnings.value = [];
  validationErrors.value = [];
  clearByokState();
}

function typeResponse(text) {
  if (responseTimer.value) {
    clearInterval(responseTimer.value);
  }
  typedResponse.value = "";
  if (!text) return;

  let index = 0;
  responseTimer.value = setInterval(() => {
    index += 2;
    typedResponse.value = text.slice(0, index);
    if (index >= text.length) {
      clearInterval(responseTimer.value);
      responseTimer.value = null;
    }
  }, 8);
}

function onSliderInput(dimensionId, event) {
  const index = Number(event.target?.value ?? 2);
  const nextValue = levels[index] ?? "medium";
  voice.value = { ...voice.value, [dimensionId]: nextValue };
  if (dimensionId === "humor" && nextValue === "very-low") {
    humorStyle.value = "none";
  }
}

function levelToIndex(level) {
  const idx = levels.indexOf(level);
  return idx >= 0 ? idx : 2;
}

function persistByokKey() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`traits_docs_api_key_${byokProvider.value}`, byokKey.value);
}

function readByokKey() {
  if (typeof window === "undefined") return;
  byokKey.value = window.localStorage.getItem(`traits_docs_api_key_${byokProvider.value}`) ?? "";
}

function extractAssistantContent(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && typeof part.text === "string") return part.text;
        return "";
      })
      .join("")
      .trim();
  }
  return "";
}

async function generateLiveResponse() {
  if (!canGenerateLiveResponse.value) return;
  const requestId = byokRequestId.value + 1;
  byokRequestId.value = requestId;
  byokLoading.value = true;
  byokResponse.value = "";
  byokError.value = "";
  byokTier1Score.value = null;
  typedResponse.value = "";

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${byokKey.value.trim()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: compiledPrompt.value },
          { role: "user", content: activeScenario.value.prompt }
        ]
      })
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Invalid API key. Check your key and try again.");
      }
      if (response.status === 429) {
        throw new Error("Rate limited. Wait a moment and try again.");
      }
      const apiMessage =
        payload &&
        typeof payload === "object" &&
        payload.error &&
        typeof payload.error === "object" &&
        typeof payload.error.message === "string"
          ? payload.error.message
          : `OpenAI request failed (${response.status}).`;
      throw new Error(apiMessage);
    }

    const text = extractAssistantContent(payload);
    if (!text) {
      throw new Error("OpenAI response did not include assistant text.");
    }

    if (requestId !== byokRequestId.value) return;
    byokResponse.value = text;

    try {
      const profile = buildMutableProfile();
      byokTier1Score.value = Number(evaluateTier1Response(profile, text).score);
    } catch {
      byokTier1Score.value = null;
    }
  } catch (error) {
    if (requestId !== byokRequestId.value) return;
    if (error instanceof TypeError) {
      byokError.value = "Network error. Check your connection.";
    } else {
      byokError.value = error instanceof Error ? error.message : String(error);
    }
  } finally {
    if (requestId === byokRequestId.value) {
      byokLoading.value = false;
    }
  }
}

function syncUrlState() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams();
  params.set("profile", selectedProfileId.value);
  params.set("scenario", selectedScenarioId.value);
  params.set("formality", voice.value.formality);
  params.set("warmth", voice.value.warmth);
  params.set("verbosity", voice.value.verbosity);
  params.set("directness", voice.value.directness);
  params.set("empathy", voice.value.empathy);
  params.set("humor", voice.value.humor);
  params.set("humorStyle", humorStyle.value);
  const next = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
  window.history.replaceState({}, "", next);
}

function applyUrlState() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const profileFromUrl = params.get("profile");
  if (profileFromUrl && profileMap.has(profileFromUrl)) {
    selectedProfileId.value = profileFromUrl;
  }

  const profile = profileMap.get(selectedProfileId.value) ?? orderedProfiles[0];
  resetProfileState(profile);

  for (const dimension of dimensions) {
    const fromUrl = params.get(dimension.id);
    if (fromUrl && levels.includes(fromUrl)) {
      voice.value = { ...voice.value, [dimension.id]: fromUrl };
    }
  }

  const styleFromUrl = params.get("humorStyle");
  if (styleFromUrl && humorStyles.includes(styleFromUrl)) {
    humorStyle.value = styleFromUrl;
  }

  const scenarioFromUrl = params.get("scenario");
  if (scenarioFromUrl && profile.scenarios.some((scenario) => scenario.id === scenarioFromUrl)) {
    selectedScenarioId.value = scenarioFromUrl;
  }
}

watch(selectedProfileId, (profileId) => {
  const profile = profileMap.get(profileId);
  if (!profile) return;
  resetProfileState(profile);
});

watch(
  () => [displayedResponseText.value, byokLoading.value, byokError.value],
  ([responseText, loading, errorText]) => {
    if (loading || errorText || !responseText) {
      typeResponse("");
      return;
    }
    typeResponse(responseText);
  },
  { immediate: true }
);

watch(
  () => [
    selectedProfileId.value,
    voice.value.formality,
    voice.value.warmth,
    voice.value.verbosity,
    voice.value.directness,
    voice.value.empathy,
    voice.value.humor,
    humorStyle.value
  ],
  () => {
    clearByokState();
    scheduleCompilation();
  }
);

watch(selectedScenarioId, () => {
  clearByokState();
});

watch(
  () => [
    selectedProfileId.value,
    selectedScenarioId.value,
    voice.value.formality,
    voice.value.warmth,
    voice.value.verbosity,
    voice.value.directness,
    voice.value.empathy,
    voice.value.humor,
    humorStyle.value
  ],
  syncUrlState
);

watch(byokProvider, () => {
  clearByokState();
  readByokKey();
});

onMounted(() => {
  applyUrlState();
  readByokKey();
  scheduleCompilation();
});

onBeforeUnmount(() => {
  if (responseTimer.value) {
    clearInterval(responseTimer.value);
  }
  if (compileTimer.value) {
    clearTimeout(compileTimer.value);
  }
});
</script>

<style scoped>
.playground-shell {
  display: grid;
  gap: 1.1rem;
}

.playground-header {
  border: 1px solid #294166;
  border-radius: 1rem;
  background: radial-gradient(circle at top right, #101f37 0%, #0b1424 56%, #0a1220 100%);
  color: #dbeafe;
  padding: 1.15rem;
}

.playground-header h1 {
  margin: 0.45rem 0;
  line-height: 1.2;
  font-size: clamp(1.35rem, 2vw + 0.6rem, 2.05rem);
}

.playground-header p {
  margin: 0;
  color: #b8c9e4;
}

.eyebrow {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #8db4f3;
  font-size: 0.74rem;
  font-weight: 700;
}

.playground-grid {
  display: grid;
  gap: 0.9rem;
  grid-template-columns: minmax(0, 420px) minmax(0, 1fr);
}

.panel {
  border: 1px solid #d2deef;
  border-radius: 0.9rem;
  background: #ffffff;
  padding: 0.95rem;
}

.panel h2 {
  margin: 0;
  font-size: 1.05rem;
}

.field {
  margin-top: 0.75rem;
  display: grid;
  gap: 0.3rem;
}

.field span {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #64748b;
  font-weight: 700;
}

.field select,
.field input {
  border: 1px solid #cbd8ea;
  border-radius: 0.6rem;
  background: #fff;
  color: #0f172a;
  padding: 0.5rem 0.6rem;
  font-size: 0.9rem;
}

.slider-list {
  margin-top: 0.45rem;
  display: grid;
  gap: 0.8rem;
}

.slider-field {
  border: 1px solid #d9e4f3;
  border-radius: 0.75rem;
  background: #f8fbff;
  padding: 0.6rem 0.65rem;
}

.slider-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.85rem;
}

.slider-meta span {
  text-transform: capitalize;
  color: #1d4ed8;
  font-weight: 700;
}

.slider-field input[type="range"] {
  width: 100%;
}

.tick-row {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  margin-top: 0.35rem;
  color: #64748b;
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.tick-row span:nth-child(3) {
  text-align: center;
}

.tick-row span:nth-child(4),
.tick-row span:nth-child(5) {
  text-align: right;
}

.yaml-block {
  margin-top: 0.8rem;
}

.yaml-block p {
  margin: 0;
  color: #475569;
  font-size: 0.8rem;
  font-weight: 600;
}

.yaml-block pre {
  margin: 0.45rem 0 0;
  border-radius: 0.75rem;
  border: 1px solid #293d62;
  background: #0f172a;
  color: #dbeafe;
  padding: 0.75rem;
  max-height: 260px;
  overflow: auto;
  font-size: 0.72rem;
  line-height: 1.4;
}

.compiled-note {
  margin: 0.35rem 0 0;
  color: #475569;
}

.validation-summary {
  margin: 0.5rem 0 0;
  font-size: 0.84rem;
  color: #14532d;
}

.validation-summary.error {
  color: #991b1b;
}

.validation-list {
  margin: 0.45rem 0 0;
  padding: 0.55rem 0.7rem;
  border: 1px solid #d6e2f1;
  border-radius: 0.65rem;
  background: #f8fbff;
  list-style: none;
  display: grid;
  gap: 0.35rem;
}

.validation-list li {
  display: grid;
  gap: 0.2rem;
  font-size: 0.78rem;
  color: #334155;
}

.validation-list li.warning code {
  color: #92400e;
}

.validation-list li.error code {
  color: #991b1b;
}

.validation-list code {
  font-weight: 700;
}

.compiled pre {
  margin: 0.6rem 0 0;
  border-radius: 0.75rem;
  border: 1px solid #293d62;
  background: #030b19;
  color: #dbeafe;
  min-height: 580px;
  max-height: 760px;
  overflow: auto;
  padding: 0.8rem;
  font-size: 0.72rem;
  line-height: 1.4;
}

.response {
  display: grid;
  gap: 0.75rem;
}

.response-head {
  display: flex;
  gap: 0.9rem;
  justify-content: space-between;
  align-items: flex-start;
}

.response-head p {
  margin: 0.25rem 0 0;
  color: #334155;
}

.score-pill {
  border: 1px solid #d4e0ef;
  border-radius: 0.75rem;
  background: #f8fbff;
  padding: 0.5rem 0.65rem;
  text-align: right;
}

.score-pill span {
  color: #64748b;
  display: block;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  font-weight: 700;
}

.score-pill strong {
  color: #1d4ed8;
  font-size: 1.2rem;
}

.expected {
  margin: 0;
  color: #334155;
}

.response-box {
  border: 1px solid #d5e0ee;
  border-radius: 0.8rem;
  background: #f8fbff;
  min-height: 160px;
  padding: 0.9rem;
}

.live-badge {
  display: inline-flex;
  align-items: center;
  margin-bottom: 0.55rem;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  background: #dcfce7;
  color: #166534;
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 700;
}

.response-box p {
  margin: 0;
  white-space: pre-wrap;
  color: #0f172a;
  line-height: 1.45;
}

.no-response {
  color: #475569 !important;
}

.response-error {
  color: #991b1b !important;
}

.byok {
  border-top: 1px solid #e2e8f0;
  padding-top: 0.7rem;
}

.byok summary {
  cursor: pointer;
  color: #1e293b;
  font-weight: 700;
}

.byok p {
  margin: 0.55rem 0 0;
  color: #475569;
}

.byok-actions {
  margin-top: 0.65rem;
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.byok-actions button {
  border: 1px solid #3b82f6;
  border-radius: 0.55rem;
  background: #2563eb;
  color: #ffffff;
  padding: 0.45rem 0.65rem;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
}

.byok-actions button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
  border-color: #94a3b8;
  background: #64748b;
}

.byok-status {
  font-size: 0.78rem;
  color: #334155;
}

:global(.dark) .panel {
  border-color: #30455f;
  background: #0c1727;
}

:global(.dark) .panel h2 {
  color: #e2e8f0;
}

:global(.dark) .field span,
:global(.dark) .compiled-note,
:global(.dark) .validation-summary,
:global(.dark) .score-pill span,
:global(.dark) .byok p,
:global(.dark) .tick-row,
:global(.dark) .yaml-block p {
  color: #9ab0cf;
}

:global(.dark) .validation-summary.error {
  color: #fda4af;
}

:global(.dark) .validation-list {
  border-color: #324865;
  background: #0f1b2e;
}

:global(.dark) .validation-list li {
  color: #c7d5ec;
}

:global(.dark) .validation-list li.warning code {
  color: #fcd34d;
}

:global(.dark) .validation-list li.error code {
  color: #fca5a5;
}

:global(.dark) .field select,
:global(.dark) .field input {
  border-color: #3a516f;
  background: #0e1a2d;
  color: #e2e8f0;
}

:global(.dark) .slider-field {
  border-color: #324863;
  background: #0f1b2e;
}

:global(.dark) .slider-meta strong,
:global(.dark) .response-head p,
:global(.dark) .expected,
:global(.dark) .response-box p,
:global(.dark) .byok summary {
  color: #dbe7f9;
}

:global(.dark) .score-pill {
  border-color: #324865;
  background: #122237;
}

:global(.dark) .response-box {
  border-color: #324865;
  background: #0f1b2e;
}

:global(.dark) .no-response {
  color: #adc0dc !important;
}

:global(.dark) .response-error {
  color: #fca5a5 !important;
}

:global(.dark) .live-badge {
  background: #134e4a;
  color: #99f6e4;
}

:global(.dark) .byok {
  border-top-color: #30455f;
}

:global(.dark) .byok-actions button {
  border-color: #60a5fa;
  background: #2563eb;
}

:global(.dark) .byok-actions button:disabled {
  border-color: #4b5563;
  background: #334155;
}

:global(.dark) .byok-status {
  color: #cbd5e1;
}

@media (max-width: 1100px) {
  .playground-grid {
    grid-template-columns: 1fr;
  }

  .compiled pre {
    min-height: 320px;
    max-height: 520px;
  }
}

@media (max-width: 720px) {
  .response-head {
    flex-direction: column;
  }
}
</style>
