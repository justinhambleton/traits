#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_SCENARIO_FILE = "experiment/calibration/scenarios.v1.json";

function usage() {
  return [
    "Usage:",
    "  node experiment/scripts/generate-playground-run.mjs --profile <path> [options]",
    "",
    "Options:",
    "  --profile <path>          Profile YAML path (required)",
    "  --suite <name>            Built-in suite name (default: profile slug)",
    "  --model <model>           OpenAI generation model (default: gpt-4o)",
    "  --out <path>              Output run path (default: experiment/evaluation/runs/<date>-showcase-<slug>.json)",
    "  --openai-api-key <key>    Override TRAITS_OPENAI_API_KEY",
    "  --openai-base-url <url>   Override OpenAI API base URL",
    "  --timeout-ms <ms>         Provider timeout override",
    "  --max-retries <n>         Provider retry count override",
    "  --retry-base-ms <ms>      Provider retry backoff base override",
    "  --help, -h                Show this message",
    ""
  ].join("\n");
}

function parseArgs(argv) {
  const out = {
    profile: null,
    suite: null,
    model: "gpt-4o",
    out: null,
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
      arg === "--profile" ||
      arg === "--suite" ||
      arg === "--model" ||
      arg === "--out" ||
      arg === "--openai-api-key" ||
      arg === "--openai-base-url" ||
      arg === "--timeout-ms" ||
      arg === "--max-retries" ||
      arg === "--retry-base-ms"
    ) {
      const value = argv[index + 1];
      if (!value) return { error: `Missing value for ${arg}` };
      if (arg === "--profile") out.profile = value;
      if (arg === "--suite") out.suite = value;
      if (arg === "--model") out.model = value;
      if (arg === "--out") out.out = value;
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

  if (!out.profile) {
    return { error: "--profile is required" };
  }

  for (const field of ["timeoutMs", "maxRetries", "retryBaseMs"]) {
    const value = out[field];
    if (value == null) continue;
    if (!Number.isInteger(value) || value < 0) {
      return { error: `Invalid ${field} value: ${value}` };
    }
  }

  return { value: out };
}

function assertFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} not found: ${filePath}`);
  }
}

function profileSlug(profilePath) {
  return path.basename(profilePath, path.extname(profilePath)).toLowerCase();
}

function scenarioTranscript(scenario) {
  if (!Array.isArray(scenario?.messages)) return "";
  return scenario.messages
    .map((message) => `${String(message?.role ?? "user")}: ${String(message?.content ?? "")}`)
    .join("\n");
}

function extractJSONObject(text) {
  const raw = String(text ?? "").trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Provider response did not contain JSON.");
    return JSON.parse(match[0]);
  }
}

function buildGenerationSystemPrompt(baseSystemPrompt) {
  return [
    "Generate one assistant reply for the provided conversation transcript.",
    "Apply the following system guidance when producing the reply.",
    "<system_guidance>",
    String(baseSystemPrompt ?? ""),
    "</system_guidance>",
    'Return strict JSON only: {"assistant_response":"..."}',
    "No markdown, no extra keys."
  ].join("\n");
}

function buildGenerationUserPrompt(scenario) {
  return [
    `Scenario id: ${String(scenario?.id ?? "unknown")}`,
    scenario?.expected_behavior
      ? `Expected behavior: ${String(scenario.expected_behavior)}`
      : "Expected behavior: (not provided)",
    "Conversation transcript:",
    scenarioTranscript(scenario)
  ].join("\n");
}

function ensureOutputPath(repoRoot, requested, slug) {
  if (requested) return path.resolve(process.cwd(), requested);
  const date = new Date().toISOString().slice(0, 10);
  return path.join(repoRoot, "experiment/evaluation/runs", `${date}-showcase-${slug}.json`);
}

async function loadCore(repoRoot) {
  const distPath = path.join(repoRoot, "packages/core/dist/internal.js");
  assertFile(distPath, "Core dist entry");
  const core = await import(distPath);
  const required = [
    "compileProfile",
    "loadBuiltInEvalSuite",
    "openAIJudge",
    "runTier1EvaluationForProfile"
  ];
  for (const key of required) {
    if (typeof core[key] !== "function") {
      throw new Error(`${key} export is missing from core dist bundle.`);
    }
  }
  return core;
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.help) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }
  if (parsed.error) {
    process.stderr.write(`Error: ${parsed.error}\n\n`);
    process.stderr.write(`${usage()}\n`);
    return 1;
  }

  const options = parsed.value;
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const profilePath = path.resolve(repoRoot, options.profile);
  const slug = profileSlug(profilePath);
  const suiteName = String(options.suite ?? slug).trim().toLowerCase();
  const outFile = ensureOutputPath(repoRoot, options.out, slug);
  const openaiApiKey = options.openaiApiKey ?? process.env.TRAITS_OPENAI_API_KEY ?? null;

  if (!openaiApiKey) {
    throw new Error("Missing OpenAI API key. Set TRAITS_OPENAI_API_KEY or pass --openai-api-key.");
  }

  assertFile(profilePath, "Profile file");
  const core = await loadCore(repoRoot);
  const suite = core.loadBuiltInEvalSuite(suiteName);
  if (!suite) {
    throw new Error(`Built-in suite not found: ${suiteName}`);
  }

  const bundledProfilesDir = path.join(repoRoot, "profiles");
  const knowledgeBaseDir = path.join(repoRoot, "knowledge-base");
  const compiled = core.compileProfile(profilePath, {
    model: options.model,
    bundledProfilesDir,
    knowledgeBaseDir
  });

  const samples = [];
  for (const scenario of suite.scenarios) {
    const raw = await core.openAIJudge({
      apiKey: openaiApiKey,
      systemPrompt: buildGenerationSystemPrompt(compiled.text),
      userPrompt: buildGenerationUserPrompt(scenario),
      model: options.model,
      baseUrl: options.openaiBaseUrl ?? undefined,
      timeoutMs: options.timeoutMs ?? undefined,
      maxRetries: options.maxRetries ?? undefined,
      retryBaseMs: options.retryBaseMs ?? undefined
    });
    const parsedResponse = extractJSONObject(raw);
    const response = String(parsedResponse.assistant_response ?? "").trim();
    if (!response) {
      throw new Error(
        `Generated response missing assistant_response for scenario ${String(scenario?.id ?? "unknown")}.`
      );
    }

    samples.push({
      id: String(scenario?.id ?? "unknown"),
      prompt: scenarioTranscript(scenario),
      response
    });
    process.stderr.write(`generated: ${String(scenario?.id ?? "unknown")}\n`);
  }

  const tier1 = core.runTier1EvaluationForProfile(profilePath, samples, {
    bundledProfilesDir,
    includeHelpfulness: true
  });

  const scenarioIds = suite.scenarios.map((scenario) => String(scenario.id));
  const result = {
    generated_at: new Date().toISOString(),
    method: "playground-precomputed-compiled",
    profile_path: path.relative(repoRoot, profilePath),
    scenario_file: DEFAULT_SCENARIO_FILE,
    scenario_ids: scenarioIds,
    suite: {
      id: suite.id,
      description: suite.description
    },
    generation: {
      provider: "openai",
      model: options.model,
      compile_model: options.model
    },
    keys_present: {
      openai: true,
      anthropic: Boolean(process.env.TRAITS_ANTHROPIC_API_KEY)
    },
    tier_requested: 1,
    tier_resolution: {
      tier_requested: 1,
      tier_executed: 1,
      tiers_run: [1],
      blocked: []
    },
    arms: {
      compiled: {
        system_prompt: "compiled personality prompt",
        samples,
        reports: {
          tier1: tier1.report
        }
      }
    }
  };

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  process.stdout.write(
    `Wrote ${path.relative(repoRoot, outFile)} (${samples.length} samples, Tier1 avg ${Number(
      tier1.report.average_score
    ).toFixed(4)})\n`
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
