#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MODELS = ["claude", "gpt"];

function usage() {
  return [
    "Usage:",
    "  node experiment/scripts/report-calibration-status.mjs [--strict] [--json] [--knowledge-base-dir <dir>]",
    "",
    "Options:",
    "  --strict                 Exit non-zero if uncalibrated or placeholder entries exist",
    "  --json                   Emit machine-readable JSON summary",
    "  --knowledge-base-dir     Override knowledge-base directory",
    "  --help, -h               Show this message",
    ""
  ].join("\n");
}

function parseArgs(argv) {
  const out = {
    strict: false,
    json: false,
    knowledgeBaseDir: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--strict") {
      out.strict = true;
      continue;
    }

    if (arg === "--json") {
      out.json = true;
      continue;
    }

    if (arg === "--knowledge-base-dir") {
      const value = argv[index + 1];
      if (!value) {
        return { error: "Missing value for --knowledge-base-dir" };
      }
      out.knowledgeBaseDir = value;
      index += 1;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      return { help: true };
    }

    return { error: `Unknown option: ${arg}` };
  }

  return { value: out };
}

function isPlaceholderPattern(model, pattern) {
  if (typeof pattern !== "string") return false;
  const text = pattern.trim();
  if (!text) return false;

  if (model === "claude") {
    return /^Claude pattern:/i.test(text);
  }

  if (model === "gpt") {
    return /^GPT pattern:/i.test(text);
  }

  return false;
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function summarizeModel(model, knowledgeBaseDir) {
  const patternFile = path.resolve(knowledgeBaseDir, model, "patterns.json");
  if (!fs.existsSync(patternFile)) {
    throw new Error(`Pattern file not found: ${patternFile}`);
  }

  const data = readJson(patternFile);
  const dimensions = data?.dimensions ?? {};
  const interactions = data?.interactions ?? {};

  let dimensionTotal = 0;
  let dimensionCalibrated = 0;
  let dimensionPlaceholder = 0;

  for (const levelMap of Object.values(dimensions)) {
    if (!levelMap || typeof levelMap !== "object") continue;
    for (const entry of Object.values(levelMap)) {
      dimensionTotal += 1;
      if (entry && typeof entry === "object" && entry.calibrated === true) {
        dimensionCalibrated += 1;
      }
      if (entry && typeof entry === "object" && isPlaceholderPattern(model, entry.pattern)) {
        dimensionPlaceholder += 1;
      }
    }
  }

  let interactionTotal = 0;
  let interactionCalibrated = 0;
  let interactionPlaceholder = 0;

  for (const entry of Object.values(interactions)) {
    interactionTotal += 1;
    if (entry && typeof entry === "object" && entry.calibrated === true) {
      interactionCalibrated += 1;
    }
    if (entry && typeof entry === "object" && isPlaceholderPattern(model, entry.pattern)) {
      interactionPlaceholder += 1;
    }
  }

  const uncalibratedCount =
    (dimensionTotal - dimensionCalibrated) + (interactionTotal - interactionCalibrated);
  const placeholderCount = dimensionPlaceholder + interactionPlaceholder;

  return {
    model,
    file: patternFile,
    dimensions: {
      total: dimensionTotal,
      calibrated: dimensionCalibrated,
      uncalibrated: dimensionTotal - dimensionCalibrated,
      placeholders: dimensionPlaceholder
    },
    interactions: {
      total: interactionTotal,
      calibrated: interactionCalibrated,
      uncalibrated: interactionTotal - interactionCalibrated,
      placeholders: interactionPlaceholder
    },
    totals: {
      entries: dimensionTotal + interactionTotal,
      calibrated: dimensionCalibrated + interactionCalibrated,
      uncalibrated: uncalibratedCount,
      placeholders: placeholderCount
    },
    strictPass: uncalibratedCount === 0 && placeholderCount === 0
  };
}

function buildOverallSummary(models) {
  const totals = {
    entries: 0,
    calibrated: 0,
    uncalibrated: 0,
    placeholders: 0
  };

  for (const model of models) {
    totals.entries += model.totals.entries;
    totals.calibrated += model.totals.calibrated;
    totals.uncalibrated += model.totals.uncalibrated;
    totals.placeholders += model.totals.placeholders;
  }

  return {
    ...totals,
    strictPass: totals.uncalibrated === 0 && totals.placeholders === 0
  };
}

function printTextReport(summary) {
  process.stdout.write("Calibration status\n");
  process.stdout.write("==================\n");

  for (const model of summary.models) {
    process.stdout.write(`\nModel: ${model.model}\n`);
    process.stdout.write(`  file: ${model.file}\n`);
    process.stdout.write(
      `  dimensions: ${model.dimensions.calibrated}/${model.dimensions.total} calibrated, ${model.dimensions.placeholders} placeholders\n`
    );
    process.stdout.write(
      `  interactions: ${model.interactions.calibrated}/${model.interactions.total} calibrated, ${model.interactions.placeholders} placeholders\n`
    );
  }

  process.stdout.write("\nOverall\n");
  process.stdout.write(
    `  calibrated: ${summary.overall.calibrated}/${summary.overall.entries}\n`
  );
  process.stdout.write(`  uncalibrated: ${summary.overall.uncalibrated}\n`);
  process.stdout.write(`  placeholders: ${summary.overall.placeholders}\n`);
  process.stdout.write(
    `  strict: ${summary.overall.strictPass ? "PASS" : "FAIL"}\n`
  );
}

function main() {
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
  const knowledgeBaseDir = options.knowledgeBaseDir
    ? path.resolve(process.cwd(), options.knowledgeBaseDir)
    : path.join(repoRoot, "knowledge-base");

  let models;
  try {
    models = MODELS.map((model) => summarizeModel(model, knowledgeBaseDir));
  } catch (error) {
    process.stderr.write(
      `Error: ${error instanceof Error ? error.message : String(error)}\n`
    );
    return 1;
  }

  const summary = {
    generated_at: new Date().toISOString(),
    knowledge_base_dir: knowledgeBaseDir,
    models,
    overall: buildOverallSummary(models)
  };

  if (options.json) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  } else {
    printTextReport(summary);
  }

  if (options.strict && !summary.overall.strictPass) {
    return 2;
  }

  return 0;
}

process.exitCode = main();
