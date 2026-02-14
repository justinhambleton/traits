#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_SCENARIO_FILE = "experiment/calibration/scenarios.v1.json";
const DEFAULT_IDS = [
  "support-password-reset",
  "billing-double-charge",
  "mixed-refund-policy",
  "returning-user-context"
];

function usage() {
  return [
    "Usage:",
    "  node experiment/scripts/run-resolve-ab-tier1.mjs [options]",
    "",
    "Options:",
    "  --profile <path>            Profile path (default: profiles/resolve.yaml)",
    `  --scenarios <path>          Scenario file (default: ${DEFAULT_SCENARIO_FILE})`,
    "  --ids <csv>                 Scenario ids (default: support-password-reset,billing-double-charge,mixed-refund-policy,returning-user-context)",
    "  --out <path>                Output JSON report path",
    "  --help, -h                  Show this message",
    ""
  ].join("\n");
}

function parseArgs(argv) {
  const out = {
    profile: "profiles/resolve.yaml",
    scenarios: DEFAULT_SCENARIO_FILE,
    ids: [...DEFAULT_IDS],
    out: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") return { help: true };

    if (arg === "--profile" || arg === "--scenarios" || arg === "--ids" || arg === "--out") {
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
      if (arg === "--out") out.out = value;
      index += 1;
      continue;
    }

    return { error: `Unknown option: ${arg}` };
  }

  if (out.ids.length === 0) return { error: "At least one scenario id is required." };
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

function ensureOutputPath(repoRoot, requestedPath) {
  if (requestedPath) return path.resolve(process.cwd(), requestedPath);
  return path.join(repoRoot, "experiment/evaluation/runs/2026-02-14-resolve-ab-tier1.json");
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

function compiledResponseForScenario(id) {
  if (id === "support-password-reset") {
    return "I understand, and I'll take care of this. Here's what I can do: 1) go to Sign In -> Forgot Password, 2) choose SMS or email verification, 3) reset your password, and 4) sign in again. If step 2 fails after you changed phones, use account recovery and I can walk you through it.";
  }

  if (id === "billing-double-charge") {
    return "I understand this is frustrating, and I'll take care of this now. Here's what I can do: I will verify the duplicate charge, reverse the extra transaction, and confirm the refund timeline in writing. Please share the charged date and last 4 digits of the payment method.";
  }

  if (id === "mixed-refund-policy") {
    return "I understand why you are asking. Here's what I can do: I will submit an exception review today, include your timeline details, and share the decision status once it posts. If the exception is not approved, I will provide the best available alternative path immediately.";
  }

  if (id === "returning-user-context") {
    return "I understand, and I'll take care of this. Here's what I can do: I will check claim WR-99213 now, confirm its current stage, and tell you the next required step if anything is still pending.";
  }

  return "I understand. Here's what I can do: provide a clear next step and follow through.";
}

function genericResponseForScenario(id) {
  if (id === "support-password-reset") {
    return "Go to the sign-in page, choose forgot password, verify your identity, and create a new password. If your phone changed recently, use the recovery method tied to your email.";
  }

  if (id === "billing-double-charge") {
    return "I can review the duplicate charge and request a correction. Please provide the transaction date and payment details so support can process the adjustment.";
  }

  if (id === "mixed-refund-policy") {
    return "You are outside the refund window, but an exception request may still be possible. Submit the request with your purchase details and wait for the final decision.";
  }

  if (id === "returning-user-context") {
    return "I can check the status of claim WR-99213 and report the next action needed. I will confirm whether additional documents are required.";
  }

  return "I can provide a clear next step and a concrete follow-up action.";
}

function buildSamplesForArm(scenarios, responseFn) {
  return scenarios.map((scenario) => ({
    id: String(scenario.id),
    prompt: Array.isArray(scenario.messages)
      ? scenario.messages
          .map((message) => `${String(message?.role ?? "user")}: ${String(message?.content ?? "")}`)
          .join("\n")
      : "",
    response: responseFn(String(scenario.id))
  }));
}

function scoreById(report) {
  const map = new Map();
  for (const sample of report.samples ?? []) {
    map.set(String(sample.id), sample);
  }
  return map;
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(Number(value) * factor) / factor;
}

function printSummary(summary) {
  process.stdout.write("Resolve Tier 1 A/B Evaluation\n");
  process.stdout.write("=============================\n");
  process.stdout.write(`Profile: ${summary.profile_path}\n`);
  process.stdout.write(`Scenarios: ${summary.scenario_ids.join(", ")}\n\n`);
  process.stdout.write(`Compiled arm average: ${summary.arms.compiled.average_score.toFixed(4)}\n`);
  process.stdout.write(`Generic arm average:  ${summary.arms.generic.average_score.toFixed(4)}\n`);
  process.stdout.write(`Delta (compiled - generic): ${summary.delta.average_score.toFixed(4)}\n\n`);
  process.stdout.write("Per-scenario deltas:\n");
  for (const item of summary.delta.per_scenario) {
    process.stdout.write(`- ${item.id}: ${item.delta.toFixed(4)}\n`);
  }
}

async function loadCore(repoRoot) {
  const distPath = path.join(repoRoot, "packages/core/dist/internal.js");
  assertFile(distPath, "Core dist entry");
  const mod = await import(distPath);
  if (typeof mod.runTier1EvaluationForProfile !== "function") {
    throw new Error("runTier1EvaluationForProfile export not found in core dist bundle.");
  }
  return mod;
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
  const bundledProfilesDir = path.join(repoRoot, "profiles");
  const scenarioFile = path.resolve(repoRoot, options.scenarios);
  const outFile = ensureOutputPath(repoRoot, options.out);

  assertFile(profilePath, "Profile file");
  assertFile(scenarioFile, "Scenario file");

  const scenarios = pickScenarios(readJson(scenarioFile), options.ids);
  const compiledSamples = buildSamplesForArm(scenarios, compiledResponseForScenario);
  const genericSamples = buildSamplesForArm(scenarios, genericResponseForScenario);

  const { runTier1EvaluationForProfile } = await loadCore(repoRoot);

  const compiled = runTier1EvaluationForProfile(profilePath, compiledSamples, {
    bundledProfilesDir,
    includeHelpfulness: true
  });
  const generic = runTier1EvaluationForProfile(profilePath, genericSamples, {
    bundledProfilesDir,
    includeHelpfulness: true
  });

  const compiledById = scoreById(compiled.report);
  const genericById = scoreById(generic.report);

  const perScenarioDelta = options.ids.map((id) => {
    const compiledScore = Number(compiledById.get(id)?.score ?? 0);
    const genericScore = Number(genericById.get(id)?.score ?? 0);
    return {
      id,
      compiled_score: round(compiledScore),
      generic_score: round(genericScore),
      delta: round(compiledScore - genericScore)
    };
  });

  const summary = {
    generated_at: new Date().toISOString(),
    method: "deterministic-tier1-template-ab",
    profile_path: path.relative(repoRoot, profilePath),
    scenario_file: path.relative(repoRoot, scenarioFile),
    scenario_ids: options.ids,
    arms: {
      compiled: {
        system_prompt: "compiled resolve personality block",
        average_score: round(compiled.report.average_score),
        report: compiled.report
      },
      generic: {
        system_prompt: "You are a helpful customer support assistant.",
        average_score: round(generic.report.average_score),
        report: generic.report
      }
    },
    delta: {
      average_score: round(compiled.report.average_score - generic.report.average_score),
      per_scenario: perScenarioDelta
    },
    caveats: [
      "Responses are deterministic templates, not live model generations.",
      "Tier 1 scores vocabulary/helpfulness structure and does not directly measure full conversational quality."
    ]
  };

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  printSummary(summary);
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
