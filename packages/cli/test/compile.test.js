import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const CLI_ENTRY = path.join(ROOT, "packages/cli/dist/traits.js");

function runCLI(args) {
  return spawnSync(process.execPath, [CLI_ENTRY, ...args], {
    cwd: ROOT,
    encoding: "utf8"
  });
}

test("traits compile outputs personality text for Claude", () => {
  const result = runCLI(["compile", "profiles/resolve.yaml", "--model", "claude-sonnet"]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /\[TRAITS PERSONALITY\]/);
  assert.match(result.stdout, /<safety_floor>/);
});

test("traits compile --json returns structured compile object", () => {
  const result = runCLI([
    "compile",
    "profiles/resolve.yaml",
    "--model",
    "gpt-4o",
    "--json"
  ]);
  assert.equal(result.status, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.placement.recommended_position, "after_tools");
  assert.equal(output.metadata.safety_floor_included, true);
});

test("traits compile --json --explain includes knowledge-base pattern sources", () => {
  const result = runCLI([
    "compile",
    "profiles/resolve.yaml",
    "--model",
    "claude-sonnet",
    "--json",
    "--explain"
  ]);
  assert.equal(result.status, 0);
  const output = JSON.parse(result.stdout);
  assert.ok(
    output.trace.pattern_selections.some((selection) =>
      String(selection.source).startsWith("knowledge-base:")
    )
  );
});

test("traits compile --strict blocks warning-only profile", () => {
  const result = runCLI([
    "compile",
    "profiles/haven.yaml",
    "--model",
    "claude-sonnet",
    "--strict"
  ]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Profile is invalid/);
});

test("traits compile fails for unsafe fixture", () => {
  const result = runCLI([
    "compile",
    "profiles/test-fixtures/_unsafe-s001-test.yaml",
    "--model",
    "claude-sonnet"
  ]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /ERROR \[S001\]/);
});

test("traits compile applies context adaptations and trace output", () => {
  const result = runCLI([
    "compile",
    "profiles/haven.yaml",
    "--model",
    "claude-sonnet",
    "--context",
    "newly_diagnosed=true",
    "--context",
    "crisis_indicators=true",
    "--explain"
  ]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /directness: medium/);
  assert.match(result.stdout, /\[TRACE\]/);
  assert.match(result.stdout, /"crisis_indicators"/);
  assert.match(result.stdout, /"empathy-very-high_directness-medium"/);
  assert.match(result.stdout, /"warmth-very-high_humor-very-low"/);
});

test("traits compile --budget prints estimated token count", () => {
  const result = runCLI([
    "compile",
    "profiles/resolve.yaml",
    "--model",
    "claude-sonnet",
    "--budget"
  ]);
  assert.equal(result.status, 0);
  assert.match(result.stderr, /Estimated token count: \d+/);
});

test("traits compile --budget --budget-limit warns when estimate exceeds limit", () => {
  const result = runCLI([
    "compile",
    "profiles/resolve.yaml",
    "--model",
    "claude-sonnet",
    "--budget",
    "--budget-limit",
    "10"
  ]);
  assert.equal(result.status, 0);
  assert.match(result.stderr, /Estimated token count: \d+/);
  assert.match(result.stderr, /exceeds budget limit 10/);
});

test("traits compile rejects invalid --budget-limit value", () => {
  const result = runCLI([
    "compile",
    "profiles/resolve.yaml",
    "--model",
    "claude-sonnet",
    "--budget-limit",
    "not-a-number"
  ]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Invalid value for "--budget-limit"/);
});
