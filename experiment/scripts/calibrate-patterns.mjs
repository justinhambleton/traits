#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIMENSIONS = ["formality", "warmth", "verbosity", "directness", "empathy", "humor"];
const DEFAULT_SCENARIO_FILE = "experiment/calibration/scenarios.v1.json";

function usage() {
  return [
    "Usage:",
    "  node experiment/scripts/calibrate-patterns.mjs --model <claude|gpt> --out <dir> [options]",
    "",
    "Options:",
    `  --scenarios <path>        Scenario JSON file (default: ${DEFAULT_SCENARIO_FILE})`,
    "  --embedding-mode <mode>   deterministic|openai (default: deterministic)",
    "  --embedding-model <name>  OpenAI embedding model (default: text-embedding-3-small)",
    "  --openai-api-key <key>    Override TRAITS_OPENAI_API_KEY for openai mode",
    "  --openai-base-url <url>   Override OpenAI base URL for openai mode",
    "  --timeout-ms <ms>         OpenAI timeout override",
    "  --max-retries <n>         OpenAI retry override",
    "  --retry-base-ms <ms>      OpenAI retry backoff base",
    "  --help, -h                Show help",
    ""
  ].join("\n");
}

function parseArgs(argv) {
  const out = {
    model: null,
    scenarios: DEFAULT_SCENARIO_FILE,
    outDir: null,
    embeddingMode: "deterministic",
    embeddingModel: "text-embedding-3-small",
    openaiApiKey: null,
    openaiBaseUrl: null,
    timeoutMs: null,
    maxRetries: null,
    retryBaseMs: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") return { help: true };

    if (
      arg === "--model" ||
      arg === "--scenarios" ||
      arg === "--out" ||
      arg === "--embedding-mode" ||
      arg === "--embedding-model" ||
      arg === "--openai-api-key" ||
      arg === "--openai-base-url" ||
      arg === "--timeout-ms" ||
      arg === "--max-retries" ||
      arg === "--retry-base-ms"
    ) {
      const value = argv[index + 1];
      if (!value) return { error: `Missing value for ${arg}` };
      if (arg === "--model") out.model = value;
      if (arg === "--scenarios") out.scenarios = value;
      if (arg === "--out") out.outDir = value;
      if (arg === "--embedding-mode") out.embeddingMode = value;
      if (arg === "--embedding-model") out.embeddingModel = value;
      if (arg === "--openai-api-key") out.openaiApiKey = value;
      if (arg === "--openai-base-url") out.openaiBaseUrl = value;
      if (arg === "--timeout-ms") out.timeoutMs = Number(value);
      if (arg === "--max-retries") out.maxRetries = Number(value);
      if (arg === "--retry-base-ms") out.retryBaseMs = Number(value);
      index += 1;
      continue;
    }

    return { error: `Unknown option: ${arg}` };
  }

  if (!out.model) return { error: "Missing required --model" };
  if (!out.outDir) return { error: "Missing required --out" };

  const model = normalizeModel(out.model);
  if (!model) return { error: `Unsupported --model value: ${out.model}` };
  out.model = model;

  const mode = String(out.embeddingMode).toLowerCase();
  if (mode !== "deterministic" && mode !== "openai") {
    return { error: `Unsupported --embedding-mode value: ${out.embeddingMode}` };
  }
  out.embeddingMode = mode;

  if (out.timeoutMs != null && (!Number.isInteger(out.timeoutMs) || out.timeoutMs < 0)) {
    return { error: "--timeout-ms must be a non-negative integer" };
  }
  if (out.maxRetries != null && (!Number.isInteger(out.maxRetries) || out.maxRetries < 0)) {
    return { error: "--max-retries must be a non-negative integer" };
  }
  if (out.retryBaseMs != null && (!Number.isInteger(out.retryBaseMs) || out.retryBaseMs < 0)) {
    return { error: "--retry-base-ms must be a non-negative integer" };
  }

  return { value: out };
}

function normalizeModel(value) {
  const model = String(value).toLowerCase();
  if (model.includes("claude")) return "claude";
  if (model.includes("gpt")) return "gpt";
  return null;
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(Number(value) * factor) / factor;
}

function tokenize(text) {
  return String(text ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function hashToken(token) {
  let hash = 2166136261;
  for (let i = 0; i < token.length; i += 1) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function deterministicEmbedding(text) {
  const size = 256;
  const vector = new Array(size).fill(0);
  const tokens = tokenize(text);
  for (const token of tokens) {
    const idx = hashToken(token) % size;
    vector[idx] += 1 + token.length / 16;
  }

  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (norm === 0) return vector;
  return vector.map((value) => value / norm);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function extractScenarioPrompt(scenario) {
  const lines = [];
  for (const message of scenario.messages ?? []) {
    lines.push(`${message.role}: ${message.content}`);
  }
  return lines.join("\n");
}

function latestUserMessage(scenario) {
  const messages = Array.isArray(scenario.messages) ? scenario.messages : [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user") return String(messages[index].content ?? "");
  }
  return String(messages[0]?.content ?? "");
}

function interactionVoiceOverrides(interactionId) {
  const overrides = {};
  const parts = String(interactionId).split("_");

  for (const part of parts) {
    const match = part.match(
      /^(formality|warmth|verbosity|directness|empathy|humor)-(very-low|low|medium|high|very-high|medium-plus)$/
    );
    if (!match) continue;
    const [, dimension, rawLevel] = match;
    const level = rawLevel === "medium-plus" ? "high" : rawLevel;
    overrides[dimension] = level;
  }

  return overrides;
}

function baseProfile(model, voiceOverrides = {}) {
  return {
    schema: "v1.4",
    meta: {
      name: `calibration-${model}`,
      version: "0.1.0",
      description: `Synthetic calibration profile for ${model}`
    },
    identity: {
      role: `${model} assistant`
    },
    voice: {
      formality: "medium",
      warmth: "medium",
      verbosity: "medium",
      directness: "medium",
      empathy: "medium",
      humor: "low",
      ...voiceOverrides
    },
    behavioral_rules: ["Provide actionable guidance and preserve safety boundaries."]
  };
}

function buildDimensionEntries(patternData) {
  const entries = [];
  for (const dimension of Object.keys(patternData.dimensions ?? {})) {
    for (const level of Object.keys(patternData.dimensions[dimension] ?? {})) {
      const record = patternData.dimensions[dimension][level];
      entries.push({
        entry_type: "dimension",
        dimension,
        level,
        id: null,
        pattern: String(record?.pattern ?? "")
      });
    }
  }
  return entries;
}

function buildInteractionEntries(patternData) {
  const entries = [];
  for (const id of Object.keys(patternData.interactions ?? {})) {
    const record = patternData.interactions[id];
    entries.push({
      entry_type: "interaction",
      dimension: null,
      level: null,
      id,
      pattern: String(record?.pattern ?? "")
    });
  }
  return entries;
}

function buildResponse(entry, scenario) {
  const expected = String(scenario.expected_behavior ?? "");
  const userTail = latestUserMessage(scenario);

  return [
    entry.pattern,
    expected ? `Behavior target: ${expected}` : "",
    userTail ? `User context summary: ${userTail}` : ""
  ]
    .filter(Boolean)
    .join(" ");
}

async function loadCoreModules(repoRoot) {
  const distEntry = path.join(repoRoot, "packages/core/dist/index.js");
  if (!fs.existsSync(distEntry)) {
    throw new Error(
      `Core build output not found: ${distEntry}. Run \"pnpm --filter @traits-dev/core build\" first.`
    );
  }

  const core = await import(distEntry);
  const required = ["runTier1Evaluation", "runTier2Evaluation", "validateEvalScenarios"];
  for (const key of required) {
    if (typeof core[key] !== "function") {
      throw new Error(`Missing ${key} export in core dist bundle.`);
    }
  }
  return core;
}

async function evaluateEntry({
  entry,
  model,
  scenarios,
  runTier1Evaluation,
  runTier2Evaluation,
  tier2Options
}) {
  const voiceOverrides =
    entry.entry_type === "dimension"
      ? { [entry.dimension]: entry.level }
      : interactionVoiceOverrides(entry.id);
  const profile = baseProfile(model, voiceOverrides);

  const perScenario = [];
  for (const scenario of scenarios) {
    const sample = {
      id: scenario.id,
      prompt: extractScenarioPrompt(scenario),
      response: buildResponse(entry, scenario)
    };

    const tier1 = runTier1Evaluation(profile, [sample], {
      includeHelpfulness: true
    }).average_score;

    const tier2 = (await runTier2Evaluation(profile, [sample], {
      includeHelpfulness: true,
      ...tier2Options
    })).average_score;

    const combined = 0.3 * tier1 + 0.7 * tier2;
    perScenario.push({
      entry_type: entry.entry_type,
      dimension: entry.dimension,
      level: entry.level,
      id: entry.id,
      scenario_id: scenario.id,
      scores: {
        tier1: round(tier1),
        tier2: round(tier2),
        combined: round(combined)
      },
      notes: "offline calibration estimate"
    });
  }

  const adherence =
    perScenario.reduce((sum, item) => sum + item.scores.combined, 0) /
    (perScenario.length || 1);

  return {
    adherence: round(adherence),
    perScenario
  };
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.help) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }
  if (parsed.error) {
    process.stderr.write(`Error: ${parsed.error}\n\n${usage()}\n`);
    return 1;
  }

  const options = parsed.value;
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const scenariosFile = path.resolve(process.cwd(), options.scenarios);
  const outDir = path.resolve(process.cwd(), options.outDir);
  const patternFile = path.join(repoRoot, "knowledge-base", options.model, "patterns.json");

  if (!fs.existsSync(patternFile)) {
    process.stderr.write(`Error: Pattern file not found: ${patternFile}\n`);
    return 1;
  }
  if (!fs.existsSync(scenariosFile)) {
    process.stderr.write(`Error: Scenario file not found: ${scenariosFile}\n`);
    return 1;
  }

  const core = await loadCoreModules(repoRoot);

  const scenarioData = readJson(scenariosFile);
  const scenarios = Array.isArray(scenarioData?.scenarios) ? scenarioData.scenarios : [];
  const scenarioValidation = core.validateEvalScenarios(scenarios);
  if (!scenarioValidation.valid) {
    process.stderr.write("Error: Scenario file failed validation.\n");
    process.stderr.write(`${JSON.stringify(scenarioValidation.invalid, null, 2)}\n`);
    return 1;
  }

  const patternData = readJson(patternFile);
  const dimensionEntries = buildDimensionEntries(patternData);
  const interactionEntries = buildInteractionEntries(patternData);
  const entries = [...dimensionEntries, ...interactionEntries];

  const tier2Options = {
    embeddingFn:
      options.embeddingMode === "deterministic"
        ? async (text) => deterministicEmbedding(text)
        : undefined,
    embeddingModel: options.embeddingModel,
    openaiApiKey: options.openaiApiKey ?? process.env.TRAITS_OPENAI_API_KEY,
    openaiBaseUrl: options.openaiBaseUrl,
    fetchTimeoutMs: options.timeoutMs ?? undefined,
    fetchMaxRetries: options.maxRetries ?? undefined,
    fetchRetryBaseMs: options.retryBaseMs ?? undefined
  };

  if (options.embeddingMode === "openai" && !tier2Options.openaiApiKey) {
    process.stderr.write(
      "Error: --embedding-mode openai requires --openai-api-key or TRAITS_OPENAI_API_KEY.\n"
    );
    return 1;
  }

  const rawResults = [];
  const updates = {
    dimensions: [],
    interactions: []
  };

  for (const entry of entries) {
    const result = await evaluateEntry({
      entry,
      model: options.model,
      scenarios,
      runTier1Evaluation: core.runTier1Evaluation,
      runTier2Evaluation: core.runTier2Evaluation,
      tier2Options
    });

    rawResults.push(...result.perScenario);

    if (entry.entry_type === "dimension") {
      updates.dimensions.push({
        dimension: entry.dimension,
        level: entry.level,
        pattern: entry.pattern,
        adherence: result.adherence
      });
    } else {
      updates.interactions.push({
        id: entry.id,
        pattern: entry.pattern,
        adherence: result.adherence
      });
    }
  }

  fs.mkdirSync(outDir, { recursive: true });
  const rawPath = path.join(outDir, "raw-results.json");
  const updatesPath = path.join(outDir, "updates.json");

  writeJson(rawPath, {
    version: "v1",
    model: options.model,
    generated_at: new Date().toISOString(),
    scenario_set: scenariosFile,
    embedding_mode: options.embeddingMode,
    entry_count: entries.length,
    scenario_count: scenarios.length,
    results: rawResults
  });

  writeJson(updatesPath, updates);

  process.stdout.write(`Wrote: ${rawPath}\n`);
  process.stdout.write(`Wrote: ${updatesPath}\n`);
  process.stdout.write(
    `Entries evaluated: ${entries.length} (${updates.dimensions.length} dimensions, ${updates.interactions.length} interactions)\n`
  );
  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    process.stderr.write(
      `Error: ${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  });
