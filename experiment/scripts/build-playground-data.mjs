#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RUN_FILES = {
  haven: "experiment/evaluation/runs/2026-02-14-live-ab-haven-expanded-v1.json",
  resolve: "experiment/evaluation/runs/2026-02-14-live-ab-resolve-refined-v2.json",
  architect: "experiment/evaluation/runs/2026-02-14-live-ab-architect-v7-tier2-style-only.json"
};

const PROFILE_META = {
  haven: {
    label: "haven",
    title: "Healthcare Companion",
    accent: "#14b8a6"
  },
  resolve: {
    label: "resolve",
    title: "Customer Resolution Specialist",
    accent: "#3b82f6"
  },
  architect: {
    label: "architect",
    title: "Developer Assistant",
    accent: "#f97316"
  }
};

const PROFILE_ORDER = ["haven", "resolve", "architect"];

function assertFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function asLevel(value) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof value.target === "string") {
    return value.target;
  }
  return "medium";
}

function asHumorStyle(value) {
  if (value && typeof value === "object" && typeof value.style === "string") {
    return value.style;
  }
  return "none";
}

function cleanPrompt(prompt, fallbackPrompt) {
  const source = String(prompt ?? fallbackPrompt ?? "").trim();
  if (!source) return "";
  return source
    .replace(/^user:\s*/i, "")
    .replace(/\nassistant:\s*$/i, "")
    .trim();
}

async function loadCore(repoRoot) {
  const coreDist = path.join(repoRoot, "packages/core/dist/internal.js");
  assertFile(coreDist);
  const core = await import(coreDist);
  if (
    typeof core.compileProfile !== "function" ||
    typeof core.loadProfileFile !== "function" ||
    typeof core.renderImportedProfileYAML !== "function"
  ) {
    throw new Error(
      "Missing required core exports (compileProfile/loadProfileFile/renderImportedProfileYAML)."
    );
  }
  return core;
}

function getScenarioPrompt(scenario = {}) {
  const userMessage = (scenario.messages ?? []).find((message) => message.role === "user");
  return String(userMessage?.content ?? "");
}

async function main() {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const core = await loadCore(repoRoot);
  const scenarioFile = path.join(repoRoot, "experiment/calibration/scenarios.v1.json");
  const scenarioData = readJson(scenarioFile);
  const scenarioById = new Map(
    (scenarioData.scenarios ?? []).map((scenario) => [String(scenario.id), scenario])
  );

  const knowledgeBaseDir = path.join(repoRoot, "knowledge-base");
  const bundledProfilesDir = path.join(repoRoot, "profiles");

  const profiles = {};

  for (const slug of PROFILE_ORDER) {
    const runPath = path.join(repoRoot, RUN_FILES[slug]);
    assertFile(runPath);
    const runData = readJson(runPath);
    const profilePath = path.join(repoRoot, runData.profile_path);
    assertFile(profilePath);

    const profileDoc = core.loadProfileFile(profilePath);
    const compiled = core.compileProfile(profilePath, {
      model: "gpt-4o",
      bundledProfilesDir,
      knowledgeBaseDir
    });

    const sampleById = new Map(
      (runData.arms?.compiled?.samples ?? []).map((sample) => [String(sample.id), sample])
    );
    const tier1ById = new Map(
      (runData.arms?.compiled?.reports?.tier1?.samples ?? []).map((sample) => [
        String(sample.id),
        Number(sample.score ?? 0)
      ])
    );

    const scenarios = (runData.scenario_ids ?? []).map((scenarioId) => {
      const id = String(scenarioId);
      const scenarioDoc = scenarioById.get(id) ?? {};
      const sample = sampleById.get(id) ?? {};
      return {
        id,
        category: String(scenarioDoc.category ?? "unknown"),
        expectedBehavior: String(scenarioDoc.expected_behavior ?? ""),
        prompt: cleanPrompt(sample.prompt, getScenarioPrompt(scenarioDoc)),
        response: String(sample.response ?? ""),
        tier1Score: tier1ById.has(id) ? tier1ById.get(id) : null
      };
    });

    const baseVoice = {
      formality: asLevel(profileDoc.voice?.formality),
      warmth: asLevel(profileDoc.voice?.warmth),
      verbosity: asLevel(profileDoc.voice?.verbosity),
      directness: asLevel(profileDoc.voice?.directness),
      empathy: asLevel(profileDoc.voice?.empathy),
      humor: asLevel(profileDoc.voice?.humor)
    };

    const baseHumorStyle = asHumorStyle(profileDoc.voice?.humor);

    profiles[slug] = {
      ...PROFILE_META[slug],
      name: String(profileDoc.meta?.name ?? slug),
      description: String(profileDoc.meta?.description ?? ""),
      profilePath: runData.profile_path,
      baseVoice,
      baseHumorStyle,
      defaultScenarioId: scenarios[0]?.id ?? "",
      compiledPrompt: compiled.text,
      yamlTemplate: core.renderImportedProfileYAML(profileDoc),
      scenarios
    };
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    sourceRuns: RUN_FILES,
    scenarioFile: "experiment/calibration/scenarios.v1.json",
    profileOrder: PROFILE_ORDER,
    levels: ["very-low", "low", "medium", "high", "very-high"],
    profiles
  };

  const outputPath = path.join(repoRoot, "docs/site/data/playground.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  process.stdout.write(`Wrote ${path.relative(repoRoot, outputPath)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
