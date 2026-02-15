#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SHOWCASE_SCENARIOS = [
  "billing-double-charge",
  "debug-stack-trace",
  "formal-humor-balance",
  "urgent-project-triage"
];

const RUN_FILES = {
  haven: "experiment/evaluation/runs/2026-02-15-showcase-haven.json",
  resolve: "experiment/evaluation/runs/2026-02-15-showcase-resolve.json",
  architect: "experiment/evaluation/runs/2026-02-15-showcase-architect.json"
};

const PROFILE_ORDER = ["haven", "resolve", "architect"];

const PROFILE_META = {
  haven: {
    label: "haven",
    title: "Healthcare Companion",
    accent: "#0ea5a4"
  },
  resolve: {
    label: "resolve",
    title: "Customer Resolution Specialist",
    accent: "#2563eb"
  },
  architect: {
    label: "architect",
    title: "Developer Experience Agent",
    accent: "#ea580c"
  }
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function assertFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
}

function mapById(samples = []) {
  return new Map(samples.map((sample) => [String(sample.id), sample]));
}

async function loadCore(repoRoot) {
  const coreDist = path.join(repoRoot, "packages/core/dist/internal.js");
  assertFile(coreDist);
  const core = await import(coreDist);
  if (typeof core.compileProfile !== "function" || typeof core.loadProfileFile !== "function") {
    throw new Error("Missing required core exports (compileProfile/loadProfileFile).");
  }
  return core;
}

async function main() {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const core = await loadCore(repoRoot);
  const scenarioFile = path.join(repoRoot, "experiment/calibration/scenarios.v1.json");
  const scenarioData = readJson(scenarioFile);
  const scenarioById = new Map(
    (scenarioData.scenarios ?? []).map((scenario) => [String(scenario.id), scenario])
  );

  const bundledProfilesDir = path.join(repoRoot, "profiles");
  const knowledgeBaseDir = path.join(repoRoot, "knowledge-base");

  const profilePayload = {};
  for (const slug of PROFILE_ORDER) {
    const runPath = path.join(repoRoot, RUN_FILES[slug]);
    assertFile(runPath);
    const runData = readJson(runPath);
    const profilePath = path.join(repoRoot, runData.profile_path);
    const compiled = core.compileProfile(profilePath, {
      model: "gpt-4o",
      bundledProfilesDir,
      knowledgeBaseDir
    });
    const profileDoc = core.loadProfileFile(profilePath);
    const sampleById = mapById(runData.arms?.compiled?.samples ?? []);
    const scoreById = new Map(
      (runData.arms?.compiled?.reports?.tier1?.samples ?? []).map((row) => [
        String(row.id),
        Number(row.score ?? 0)
      ])
    );

    profilePayload[slug] = {
      ...PROFILE_META[slug],
      name: profileDoc.meta?.name ?? slug,
      description: profileDoc.meta?.description ?? "",
      profilePath: runData.profile_path,
      tier1Delta: Number(runData.deltas?.tier1?.average_score ?? 0),
      compiledSystemPrompt: compiled.text,
      samples: SHOWCASE_SCENARIOS.map((id) => {
        const sample = sampleById.get(id) ?? null;
        return {
          id,
          response: sample?.response ?? "",
          tier1Score: scoreById.get(id) ?? null
        };
      })
    };
  }

  const scenarios = SHOWCASE_SCENARIOS.map((id) => {
    const scenario = scenarioById.get(id);
    const promptMessage = (scenario?.messages ?? []).find((message) => message.role === "user");
    return {
      id,
      category: scenario?.category ?? "unknown",
      prompt: String(promptMessage?.content ?? ""),
      expectedBehavior: String(scenario?.expected_behavior ?? "")
    };
  });

  const payload = {
    generatedAt: new Date().toISOString(),
    sourceRuns: RUN_FILES,
    scenarioFile: "experiment/calibration/scenarios.v1.json",
    profileOrder: PROFILE_ORDER,
    scenarios,
    profiles: profilePayload
  };

  const outputPath = path.join(repoRoot, "docs/site/data/showcase.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  process.stdout.write(`Wrote ${path.relative(repoRoot, outputPath)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
