import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
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

test("traits eval runs Tier 1 with inline response samples", () => {
  const result = runCLI([
    "eval",
    "profiles/resolve.yaml",
    "--model",
    "claude-sonnet",
    "--response",
    "I understand. Here's what I can do to solve this issue quickly."
  ]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Tier 1 average score/);
  assert.match(result.stdout, /Baseline \(none\) Tier 1 avg/);
});

test("traits eval prints progress indicators in text mode", () => {
  const result = runCLI([
    "eval",
    "profiles/resolve.yaml",
    "--model",
    "claude-sonnet",
    "--response",
    "I understand. Here's what I can do to solve this issue quickly."
  ]);
  assert.equal(result.status, 0);
  assert.match(result.stderr, /Running Tier 1 checks/);
  assert.match(result.stderr, /Tier 1 complete/);
});

test("traits eval --json emits structured report", () => {
  const result = runCLI([
    "eval",
    "profiles/resolve.yaml",
    "--model",
    "claude-sonnet",
    "--response",
    "I understand. Here's what I can do next.",
    "--json"
  ]);
  assert.equal(result.status, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.tier_executed, 1);
  assert.equal(output.report.tier1.tier, 1);
  assert.equal(output.report.baselines.type, "offline-scaffold");
  assert.equal(output.report.overall_score > 0, true);
});

test("traits eval --format json emits structured report", () => {
  const result = runCLI([
    "eval",
    "profiles/resolve.yaml",
    "--model",
    "claude-sonnet",
    "--response",
    "I understand. Here's what I can do next.",
    "--format",
    "json"
  ]);
  assert.equal(result.status, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.format, "json");
  assert.equal(output.tier_executed, 1);
  assert.equal(output.report.tier1.tier, 1);
});

test("traits eval --format junit emits xml report", () => {
  const result = runCLI([
    "eval",
    "profiles/resolve.yaml",
    "--model",
    "claude-sonnet",
    "--response",
    "I understand. Here's what I can do next.",
    "--format",
    "junit",
    "--junit-threshold",
    "0.1"
  ]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /\<\?xml version="1.0" encoding="UTF-8"\?\>/);
  assert.match(result.stdout, /\<testsuite name="traits\.eval"/);
  assert.match(result.stdout, /\<testcase classname="traits\.eval\.resolve" name="sample-1"/);
  assert.doesNotMatch(result.stdout, /\<failure message=/);
});

test("traits eval --format junit exits non-zero on threshold failures", () => {
  const result = runCLI([
    "eval",
    "profiles/resolve.yaml",
    "--model",
    "claude-sonnet",
    "--response",
    "ok",
    "--format",
    "junit",
    "--junit-threshold-tier1",
    "0.8"
  ]);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /\<failure message="traits eval threshold failure"/);
});

test("traits eval --no-helpfulness disables helpfulness checks", () => {
  const result = runCLI([
    "eval",
    "profiles/resolve.yaml",
    "--model",
    "claude-sonnet",
    "--response",
    "I understand. Here's what I can do.",
    "--no-helpfulness",
    "--json"
  ]);
  assert.equal(result.status, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.report.tier1.samples[0].checks.helpfulness.skipped, true);
  assert.equal(output.report.baselines.helpfulness_included, false);
});

test("traits eval --no-baselines removes baseline report", () => {
  const result = runCLI([
    "eval",
    "profiles/resolve.yaml",
    "--model",
    "claude-sonnet",
    "--response",
    "I understand. Here's what I can do.",
    "--no-baselines",
    "--json"
  ]);
  assert.equal(result.status, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.report.baselines, undefined);
});

test("traits eval with tier 2 request falls back to tier 1 scaffold", () => {
  const result = runCLI([
    "eval",
    "profiles/resolve.yaml",
    "--model",
    "claude-sonnet",
    "--tier",
    "2",
    "--response",
    "I understand. Here's what I can do next."
  ]);
  assert.equal(result.status, 0);
  assert.match(result.stderr, /Tier 2 unavailable:/);
});

test("traits eval provider preference affects tier 3 availability messaging", () => {
  const result = runCLI([
    "eval",
    "profiles/resolve.yaml",
    "--model",
    "claude-sonnet",
    "--tier",
    "3",
    "--provider",
    "anthropic",
    "--response",
    "I understand. Here's what I can do next."
  ]);
  assert.equal(result.status, 0);
  assert.match(result.stderr, /Tier 3 unavailable: Tier 3 with Anthropic requires/);
});

test("traits eval returns validation failure for unsafe profile", () => {
  const result = runCLI([
    "eval",
    "profiles/test-fixtures/_unsafe-s001-test.yaml",
    "--model",
    "claude-sonnet",
    "--response",
    "sample response"
  ]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /ERROR \[S001\]/);
});

test("traits eval supports sample file input", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "traits-eval-"));
  const sampleFile = path.join(tmpDir, "samples.json");
  fs.writeFileSync(
    sampleFile,
    JSON.stringify([{ id: "sample-a", response: "Here's what I can do to help." }], null, 2),
    "utf8"
  );

  try {
    const result = runCLI([
      "eval",
      "profiles/resolve.yaml",
      "--model",
      "claude-sonnet",
      "--samples",
      sampleFile,
      "--json"
    ]);
    assert.equal(result.status, 0);
    const output = JSON.parse(result.stdout);
    assert.equal(output.report.tier1.sample_count, 1);
    assert.equal(output.report.tier1.samples[0].id, "sample-a");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("traits eval accepts provider runtime flags", () => {
  const result = runCLI([
    "eval",
    "profiles/resolve.yaml",
    "--model",
    "claude-sonnet",
    "--response",
    "I understand. Here's what I can do next.",
    "--embedding-model",
    "text-embedding-3-small",
    "--judge-model",
    "gpt-4.1-mini",
    "--openai-base-url",
    "https://api.openai.com/v1",
    "--anthropic-base-url",
    "https://api.anthropic.com/v1",
    "--timeout-ms",
    "1000",
    "--max-retries",
    "1",
    "--retry-base-ms",
    "10"
  ]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Tier 1 average score/);
});

test("traits eval rejects invalid provider runtime numeric flags", () => {
  const result = runCLI([
    "eval",
    "profiles/resolve.yaml",
    "--model",
    "claude-sonnet",
    "--response",
    "sample",
    "--max-retries",
    "-1"
  ]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Invalid "--max-retries" value/);
});

test("traits eval rejects invalid --format value", () => {
  const result = runCLI([
    "eval",
    "profiles/resolve.yaml",
    "--model",
    "claude-sonnet",
    "--response",
    "sample",
    "--format",
    "csv"
  ]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Invalid "--format" value/);
});

test("traits eval rejects invalid JUnit threshold value", () => {
  const result = runCLI([
    "eval",
    "profiles/resolve.yaml",
    "--model",
    "claude-sonnet",
    "--response",
    "sample",
    "--format",
    "junit",
    "--junit-threshold",
    "2"
  ]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Invalid "--junit-threshold" value/);
});
