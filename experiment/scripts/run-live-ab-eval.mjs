#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_SCENARIO_FILE = "experiment/calibration/scenarios.v1.json";

function usage() {
  return [
    "Usage:",
    "  node experiment/scripts/run-live-ab-eval.mjs [options]",
    "",
    "Options:",
    "  --profile <path>            Profile path (default: profiles/resolve.yaml)",
    `  --scenarios <path>          Scenario file (default: ${DEFAULT_SCENARIO_FILE})`,
    "  --ids <csv>                 Scenario ids (default depends on profile)",
    "  --tier <1|2|3>              Highest evaluation tier (default: 3)",
    "  --generation-provider <p>   auto|openai|anthropic (default: auto)",
    "  --generation-model <model>  Response generation model",
    "  --compile-model <model>     Compiler target model (default: generation model)",
    "  --judge-provider <p>        auto|openai|anthropic (default: auto)",
    "  --judge-model <model>       Tier 3 judge model",
    "  --embedding-model <model>   Tier 2 embedding model (OpenAI)",
    "  --generic-system <text>     Generic arm system prompt override",
    "  --openai-api-key <key>      Override TRAITS_OPENAI_API_KEY",
    "  --anthropic-api-key <key>   Override TRAITS_ANTHROPIC_API_KEY",
    "  --openai-base-url <url>     Override OpenAI API base URL",
    "  --anthropic-base-url <url>  Override Anthropic API base URL",
    "  --timeout-ms <ms>           Provider timeout override",
    "  --max-retries <n>           Provider retry count override",
    "  --retry-base-ms <ms>        Provider retry backoff base override",
    "  --out <path>                Output JSON report path",
    "  --dry-run                   Print execution plan and exit",
    "  --help, -h                  Show this message",
    ""
  ].join("\n");
}

function parseArgs(argv) {
  const out = {
    profile: "profiles/resolve.yaml",
    scenarios: DEFAULT_SCENARIO_FILE,
    ids: null,
    tier: 3,
    generationProvider: "auto",
    generationModel: null,
    compileModel: null,
    judgeProvider: "auto",
    judgeModel: null,
    embeddingModel: null,
    genericSystem: null,
    openaiApiKey: null,
    anthropicApiKey: null,
    openaiBaseUrl: null,
    anthropicBaseUrl: null,
    timeoutMs: null,
    maxRetries: null,
    retryBaseMs: null,
    out: null,
    dryRun: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") return { help: true };
    if (arg === "--dry-run") {
      out.dryRun = true;
      continue;
    }

    if (
      arg === "--profile" ||
      arg === "--scenarios" ||
      arg === "--ids" ||
      arg === "--tier" ||
      arg === "--generation-provider" ||
      arg === "--generation-model" ||
      arg === "--compile-model" ||
      arg === "--judge-provider" ||
      arg === "--judge-model" ||
      arg === "--embedding-model" ||
      arg === "--generic-system" ||
      arg === "--openai-api-key" ||
      arg === "--anthropic-api-key" ||
      arg === "--openai-base-url" ||
      arg === "--anthropic-base-url" ||
      arg === "--timeout-ms" ||
      arg === "--max-retries" ||
      arg === "--retry-base-ms" ||
      arg === "--out"
    ) {
      const value = argv[index + 1];
      if (!value) return { error: `Missing value for ${arg}` };

      if (arg === "--profile") out.profile = value;
      if (arg === "--scenarios") out.scenarios = value;
      if (arg === "--ids") {
        out.ids = String(value)
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
      }
      if (arg === "--tier") out.tier = Number(value);
      if (arg === "--generation-provider") out.generationProvider = String(value).toLowerCase();
      if (arg === "--generation-model") out.generationModel = value;
      if (arg === "--compile-model") out.compileModel = value;
      if (arg === "--judge-provider") out.judgeProvider = String(value).toLowerCase();
      if (arg === "--judge-model") out.judgeModel = value;
      if (arg === "--embedding-model") out.embeddingModel = value;
      if (arg === "--generic-system") out.genericSystem = value;
      if (arg === "--openai-api-key") out.openaiApiKey = value;
      if (arg === "--anthropic-api-key") out.anthropicApiKey = value;
      if (arg === "--openai-base-url") out.openaiBaseUrl = value;
      if (arg === "--anthropic-base-url") out.anthropicBaseUrl = value;
      if (arg === "--timeout-ms") out.timeoutMs = Number(value);
      if (arg === "--max-retries") out.maxRetries = Number(value);
      if (arg === "--retry-base-ms") out.retryBaseMs = Number(value);
      if (arg === "--out") out.out = value;
      index += 1;
      continue;
    }

    return { error: `Unknown option: ${arg}` };
  }

  if (![1, 2, 3].includes(out.tier)) {
    return { error: '--tier must be one of: 1, 2, 3' };
  }

  for (const field of ["generationProvider", "judgeProvider"]) {
    if (!["auto", "openai", "anthropic"].includes(out[field])) {
      return { error: `Invalid ${field} value: ${out[field]}` };
    }
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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function assertFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} not found: ${filePath}`);
  }
}

function profileSlug(profilePath) {
  return path.basename(profilePath, path.extname(profilePath)).toLowerCase();
}

function defaultScenarioIdsForProfile(slug) {
  if (slug === "haven") {
    return ["medical-chest-pain", "self-harm-ideation", "medication-dose-uncertain"];
  }
  if (slug === "resolve") {
    return [
      "support-password-reset",
      "billing-double-charge",
      "mixed-refund-policy",
      "returning-user-context"
    ];
  }
  return ["support-password-reset", "ambiguous-request-clarify", "debug-stack-trace"];
}

function defaultGenericSystemForProfile(slug) {
  if (slug === "haven") return "You are a helpful healthcare assistant.";
  if (slug === "resolve") return "You are a helpful customer support assistant.";
  if (slug === "architect") return "You are a helpful software engineering assistant.";
  return "You are a helpful assistant.";
}

function pickScenarios(scenarioData, ids) {
  const all = Array.isArray(scenarioData?.scenarios) ? scenarioData.scenarios : [];
  const indexById = new Map(all.map((scenario) => [String(scenario?.id), scenario]));
  const picked = [];

  for (const id of ids) {
    const found = indexById.get(String(id));
    if (!found) throw new Error(`Scenario id not found: ${id}`);
    picked.push(found);
  }
  return picked;
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

function ensureOutputPath(repoRoot, requested, slug) {
  if (requested) return path.resolve(process.cwd(), requested);
  const date = new Date().toISOString().slice(0, 10);
  return path.join(repoRoot, "experiment/evaluation/runs", `${date}-live-ab-${slug}.json`);
}

function resolveKeys(options) {
  return {
    openai: options.openaiApiKey ?? process.env.TRAITS_OPENAI_API_KEY ?? null,
    anthropic: options.anthropicApiKey ?? process.env.TRAITS_ANTHROPIC_API_KEY ?? null
  };
}

function chooseProvider(preference, keys) {
  const requested = String(preference ?? "auto").toLowerCase();
  if (requested === "openai") {
    if (!keys.openai) throw new Error("OpenAI provider selected but key is missing.");
    return "openai";
  }
  if (requested === "anthropic") {
    if (!keys.anthropic) throw new Error("Anthropic provider selected but key is missing.");
    return "anthropic";
  }
  if (keys.openai) return "openai";
  if (keys.anthropic) return "anthropic";
  throw new Error("No provider key available. Set TRAITS_OPENAI_API_KEY or TRAITS_ANTHROPIC_API_KEY.");
}

function chooseProviderSafe(preference, keys) {
  try {
    return {
      provider: chooseProvider(preference, keys),
      available: true,
      error: null
    };
  } catch (error) {
    return {
      provider: null,
      available: false,
      error: error instanceof Error ? error.message : String(error)
    };
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

function makeGenerationFn(core, provider, options, keys) {
  if (provider === "openai") {
    return ({ systemPrompt, userPrompt }) =>
      core.openAIJudge({
        apiKey: keys.openai,
        systemPrompt,
        userPrompt,
        model: options.generationModel ?? "gpt-4.1-mini",
        baseUrl: options.openaiBaseUrl ?? undefined,
        timeoutMs: options.timeoutMs ?? undefined,
        maxRetries: options.maxRetries ?? undefined,
        retryBaseMs: options.retryBaseMs ?? undefined
      });
  }

  return ({ systemPrompt, userPrompt }) =>
    core.anthropicJudge({
      apiKey: keys.anthropic,
      systemPrompt,
      userPrompt,
      model: options.generationModel ?? "claude-3-5-sonnet-latest",
      baseUrl: options.anthropicBaseUrl ?? undefined,
      timeoutMs: options.timeoutMs ?? undefined,
      maxRetries: options.maxRetries ?? undefined,
      retryBaseMs: options.retryBaseMs ?? undefined
    });
}

async function generateSamplesForArm({
  generationFn,
  scenarios,
  systemPrompt,
  onProgress
}) {
  const samples = [];
  for (const scenario of scenarios) {
    const raw = await generationFn({
      systemPrompt: buildGenerationSystemPrompt(systemPrompt),
      userPrompt: buildGenerationUserPrompt(scenario)
    });
    const parsed = extractJSONObject(raw);
    const response = String(parsed.assistant_response ?? "").trim();
    if (!response) {
      throw new Error(
        `Generated response missing assistant_response for scenario ${String(scenario?.id ?? "unknown")}.`
      );
    }
    const prompt = scenarioTranscript(scenario);
    samples.push({
      id: String(scenario?.id ?? "unknown"),
      prompt,
      response
    });
    onProgress?.(String(scenario?.id ?? "unknown"));
  }
  return samples;
}

function mapSampleScores(report) {
  const out = new Map();
  for (const sample of report?.samples ?? []) {
    out.set(String(sample.id), Number(sample.score ?? 0));
  }
  return out;
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(Number(value) * factor) / factor;
}

async function evaluateArm({
  core,
  profilePath,
  bundledProfilesDir,
  knowledgeBaseDir,
  modelTarget,
  samples,
  tiersRun,
  options,
  keys
}) {
  const report = {};
  if (tiersRun.includes(1)) {
    const tier1 = core.runTier1EvaluationForProfile(profilePath, samples, {
      bundledProfilesDir,
      includeHelpfulness: true
    });
    report.tier1 = tier1.report;
  }

  if (tiersRun.includes(2)) {
    const tier2 = await core.runTier2EvaluationForProfile(profilePath, samples, {
      bundledProfilesDir,
      knowledgeBaseDir,
      modelTarget,
      includeHelpfulness: true,
      openaiApiKey: keys.openai ?? undefined,
      embeddingModel: options.embeddingModel ?? undefined,
      openaiBaseUrl: options.openaiBaseUrl ?? undefined,
      fetchTimeoutMs: options.timeoutMs ?? undefined,
      fetchMaxRetries: options.maxRetries ?? undefined,
      fetchRetryBaseMs: options.retryBaseMs ?? undefined
    });
    report.tier2 = tier2.report;
  }

  if (tiersRun.includes(3)) {
    const tier3 = await core.runTier3EvaluationForProfile(profilePath, samples, {
      bundledProfilesDir,
      includeHelpfulness: true,
      provider: options.judgeProvider,
      judgeModel: options.judgeModel ?? undefined,
      openaiApiKey: keys.openai ?? undefined,
      anthropicApiKey: keys.anthropic ?? undefined,
      openaiBaseUrl: options.openaiBaseUrl ?? undefined,
      anthropicBaseUrl: options.anthropicBaseUrl ?? undefined,
      fetchTimeoutMs: options.timeoutMs ?? undefined,
      fetchMaxRetries: options.maxRetries ?? undefined,
      fetchRetryBaseMs: options.retryBaseMs ?? undefined
    });
    report.tier3 = tier3.report;
  }
  return report;
}

function printSummary(result) {
  process.stdout.write("Live A/B Evaluation\n");
  process.stdout.write("==================\n");
  process.stdout.write(`Profile: ${result.profile_path}\n`);
  process.stdout.write(`Generation provider: ${result.generation.provider}\n`);
  process.stdout.write(`Scenario ids: ${result.scenario_ids.join(", ")}\n`);
  process.stdout.write(
    `Tiers run: ${result.tier_resolution.tiers_run.join(", ") || "none"}\n\n`
  );

  for (const tier of result.tier_resolution.tiers_run) {
    const tierKey = `tier${tier}`;
    const compiled = Number(result.arms.compiled.reports?.[tierKey]?.average_score ?? 0);
    const generic = Number(result.arms.generic.reports?.[tierKey]?.average_score ?? 0);
    const delta = compiled - generic;
    process.stdout.write(
      `Tier ${tier} avg - compiled: ${compiled.toFixed(4)} | generic: ${generic.toFixed(4)} | delta: ${delta.toFixed(4)}\n`
    );
  }
}

async function loadCore(repoRoot) {
  const distPath = path.join(repoRoot, "packages/core/dist/index.js");
  assertFile(distPath, "Core dist entry");
  const core = await import(distPath);
  const required = [
    "compileProfile",
    "detectEvalTierAvailability",
    "resolveTierExecution",
    "runTier1EvaluationForProfile",
    "runTier2EvaluationForProfile",
    "runTier3EvaluationForProfile",
    "openAIJudge",
    "anthropicJudge"
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
  const scenarioFile = path.resolve(repoRoot, options.scenarios);
  const profileName = profileSlug(profilePath);
  const scenarioIds = Array.isArray(options.ids) && options.ids.length > 0
    ? options.ids
    : defaultScenarioIdsForProfile(profileName);

  const keys = resolveKeys(options);
  const openaiKeyPresent = Boolean(keys.openai);
  const anthropicKeyPresent = Boolean(keys.anthropic);

  const core = await loadCore(repoRoot);
  const generationProviderState = chooseProviderSafe(options.generationProvider, keys);
  const judgeProvider = options.judgeProvider;
  const envForAvailability = {
    TRAITS_OPENAI_API_KEY: keys.openai ?? undefined,
    TRAITS_ANTHROPIC_API_KEY: keys.anthropic ?? undefined
  };
  const tierAvailability = core.detectEvalTierAvailability(envForAvailability, {
    provider: judgeProvider
  });
  const tierResolution = core.resolveTierExecution(options.tier, tierAvailability);

  const outFile = ensureOutputPath(repoRoot, options.out, profileName);

  if (options.dryRun) {
    const plan = {
      profile_path: path.relative(repoRoot, profilePath),
      scenario_file: path.relative(repoRoot, scenarioFile),
      scenario_ids: scenarioIds,
      generation_provider: generationProviderState.provider,
      generation_available: generationProviderState.available,
      generation_unavailable_reason: generationProviderState.error,
      openai_key_present: openaiKeyPresent,
      anthropic_key_present: anthropicKeyPresent,
      tier_requested: options.tier,
      tier_resolution: tierResolution,
      out_file: outFile
    };
    process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
    return 0;
  }

  if (tierResolution.tiers_run.length === 0) {
    throw new Error("No evaluation tiers are available for requested configuration.");
  }
  if (!generationProviderState.available || !generationProviderState.provider) {
    throw new Error(
      generationProviderState.error ??
        "Generation provider is unavailable. Set provider keys or override --generation-provider."
    );
  }
  const generationProvider = generationProviderState.provider;

  assertFile(profilePath, "Profile file");
  assertFile(scenarioFile, "Scenario file");
  const scenarios = pickScenarios(readJson(scenarioFile), scenarioIds);
  const bundledProfilesDir = path.join(repoRoot, "profiles");
  const knowledgeBaseDir = path.join(repoRoot, "knowledge-base");

  const compileModel =
    options.compileModel ??
    options.generationModel ??
    (generationProvider === "openai" ? "gpt-4o" : "claude-sonnet");
  const compiled = core.compileProfile(profilePath, {
    model: compileModel,
    bundledProfilesDir,
    knowledgeBaseDir
  });
  const genericSystem =
    options.genericSystem ?? defaultGenericSystemForProfile(profileName);

  const generationFn = makeGenerationFn(core, generationProvider, options, keys);
  process.stderr.write(`Generating compiled-arm responses via ${generationProvider}...\n`);
  const compiledSamples = await generateSamplesForArm({
    generationFn,
    scenarios,
    systemPrompt: compiled.text,
    onProgress: (id) => process.stderr.write(`  compiled: ${id}\n`)
  });
  process.stderr.write(`Generating generic-arm responses via ${generationProvider}...\n`);
  const genericSamples = await generateSamplesForArm({
    generationFn,
    scenarios,
    systemPrompt: genericSystem,
    onProgress: (id) => process.stderr.write(`  generic: ${id}\n`)
  });

  process.stderr.write("Evaluating compiled arm...\n");
  const compiledReports = await evaluateArm({
    core,
    profilePath,
    bundledProfilesDir,
    knowledgeBaseDir,
    modelTarget: compileModel,
    samples: compiledSamples,
    tiersRun: tierResolution.tiers_run,
    options,
    keys
  });
  process.stderr.write("Evaluating generic arm...\n");
  const genericReports = await evaluateArm({
    core,
    profilePath,
    bundledProfilesDir,
    knowledgeBaseDir,
    modelTarget: compileModel,
    samples: genericSamples,
    tiersRun: tierResolution.tiers_run,
    options,
    keys
  });

  const deltas = {};
  for (const tier of tierResolution.tiers_run) {
    const tierKey = `tier${tier}`;
    const compiledTier = compiledReports[tierKey];
    const genericTier = genericReports[tierKey];
    const compiledAverage = Number(compiledTier?.average_score ?? 0);
    const genericAverage = Number(genericTier?.average_score ?? 0);
    const compiledById = mapSampleScores(compiledTier);
    const genericById = mapSampleScores(genericTier);
    deltas[tierKey] = {
      average_score: round(compiledAverage - genericAverage),
      per_scenario: scenarioIds.map((id) => ({
        id,
        compiled_score: round(compiledById.get(id) ?? 0),
        generic_score: round(genericById.get(id) ?? 0),
        delta: round((compiledById.get(id) ?? 0) - (genericById.get(id) ?? 0))
      }))
    };
  }

  const result = {
    generated_at: new Date().toISOString(),
    method: "live-generation-ab",
    profile_path: path.relative(repoRoot, profilePath),
    scenario_file: path.relative(repoRoot, scenarioFile),
    scenario_ids: scenarioIds,
    generation: {
      provider: generationProvider,
      model: options.generationModel ?? null,
      compile_model: compileModel
    },
    keys_present: {
      openai: openaiKeyPresent,
      anthropic: anthropicKeyPresent
    },
    tier_requested: options.tier,
    tier_resolution: tierResolution,
    arms: {
      compiled: {
        system_prompt: "compiled personality prompt",
        samples: compiledSamples,
        reports: compiledReports
      },
      generic: {
        system_prompt: genericSystem,
        samples: genericSamples,
        reports: genericReports
      }
    },
    deltas,
    caveats: [
      "Generation and scoring share provider dependencies; network/API stability affects reproducibility.",
      "Tier 2 currently uses OpenAI embeddings regardless of generation provider."
    ]
  };

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  printSummary(result);
  process.stdout.write(`\nWrote report: ${outFile}\n`);
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
