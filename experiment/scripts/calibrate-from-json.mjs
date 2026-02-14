#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

async function loadMergeCalibrationFile(repoRoot) {
  const distEntry = path.join(repoRoot, "packages/core/dist/index.js");
  if (!fs.existsSync(distEntry)) {
    throw new Error(
      `Core build output not found: ${distEntry}. Run \"pnpm --filter @traits-dev/core build\" first.`
    );
  }

  const mod = await import(distEntry);
  if (typeof mod.mergeCalibrationFile !== "function") {
    throw new Error("mergeCalibrationFile export not found in @traits-dev/core dist bundle.");
  }
  return mod.mergeCalibrationFile;
}

function usage() {
  return [
    "Usage:",
    "  node experiment/scripts/calibrate-from-json.mjs --model <claude|gpt> --input <updates.json> [--knowledge-base-dir <dir>]",
    "",
    "Input JSON format:",
    '  { "dimensions": [{ "dimension": "warmth", "level": "high", "pattern": "...", "adherence": 0.82 }],',
    '    "interactions": [{ "id": "warmth-high_directness-high", "pattern": "...", "adherence": 0.76 }] }',
    ""
  ].join("\n");
}

function parseArgs(argv) {
  const args = [...argv];
  const out = {
    model: null,
    input: null,
    knowledgeBaseDir: null
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--model" || arg === "--input" || arg === "--knowledge-base-dir") {
      const value = args[index + 1];
      if (!value) return { error: `Missing value for ${arg}` };
      if (arg === "--model") out.model = value;
      if (arg === "--input") out.input = value;
      if (arg === "--knowledge-base-dir") out.knowledgeBaseDir = value;
      index += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      return { help: true };
    }
    return { error: `Unknown option ${arg}` };
  }

  if (!out.model) return { error: "Missing required --model" };
  if (!out.input) return { error: "Missing required --input" };
  return { value: out };
}

function normalizeModel(model) {
  const normalized = String(model).toLowerCase();
  if (normalized.includes("claude")) return "claude";
  if (normalized.includes("gpt")) return "gpt";
  return normalized;
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
  const knowledgeBaseDir = options.knowledgeBaseDir
    ? path.resolve(process.cwd(), options.knowledgeBaseDir)
    : path.join(repoRoot, "knowledge-base");
  const model = normalizeModel(options.model);
  const patternFile = path.join(knowledgeBaseDir, model, "patterns.json");
  const inputFile = path.resolve(process.cwd(), options.input);

  if (!fs.existsSync(patternFile)) {
    process.stderr.write(`Error: Pattern file not found: ${patternFile}\n`);
    return 1;
  }
  if (!fs.existsSync(inputFile)) {
    process.stderr.write(`Error: Update input file not found: ${inputFile}\n`);
    return 1;
  }

  const mergeCalibrationFile = await loadMergeCalibrationFile(repoRoot);
  const updates = JSON.parse(fs.readFileSync(inputFile, "utf8"));
  const summary = mergeCalibrationFile(patternFile, updates);
  process.stdout.write(
    [
      `Updated: ${patternFile}`,
      `Dimension updates: ${summary.dimension_updates}`,
      `Interaction updates: ${summary.interaction_updates}`
    ].join("\n") + "\n"
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
