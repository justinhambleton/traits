import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const CLI_ENTRY = path.join(ROOT, "packages/cli/dist/traits.js");
const CLI_VERSION = JSON.parse(
  fs.readFileSync(path.join(ROOT, "packages/cli/package.json"), "utf8")
).version;

function runCLI(args) {
  return spawnSync(process.execPath, [CLI_ENTRY, ...args], {
    cwd: ROOT,
    encoding: "utf8"
  });
}

test("traits validate returns exit 0 for resolve profile", () => {
  const result = runCLI(["validate", "profiles/resolve.yaml"]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Profile is valid\./);
});

test("traits validate returns exit 1 with warning for haven profile", () => {
  const result = runCLI(["validate", "profiles/haven.yaml"]);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /WARNING \[S002\]/);
});

test("traits validate --strict promotes warnings and returns exit 2", () => {
  const result = runCLI(["validate", "profiles/haven.yaml", "--strict"]);
  assert.equal(result.status, 2);
  assert.match(result.stdout, /Strict mode: warnings are treated as errors/);
});

test("traits validate --json emits structured output", () => {
  const result = runCLI(["validate", "profiles/resolve.yaml", "--json"]);
  assert.equal(result.status, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.exitCode, 0);
  assert.equal(output.isValid, true);
  assert.ok(output.checks.schema_structure);
});

test("traits --json validate supports global json flag", () => {
  const result = runCLI(["--json", "validate", "profiles/resolve.yaml"]);
  assert.equal(result.status, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.isValid, true);
});

test("traits --version prints CLI package version", () => {
  const result = runCLI(["--version"]);
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), CLI_VERSION);
});

test("traits validate returns exit 2 for intentionally unsafe fixture", () => {
  const result = runCLI(["validate", "profiles/test-fixtures/_unsafe-s001-test.yaml"]);
  assert.equal(result.status, 2);
  assert.match(result.stdout, /ERROR \[S001\]/);
});

test("traits validate returns exit 1 for overspecified fixture", () => {
  const result = runCLI([
    "validate",
    "profiles/test-fixtures/_overspec-s004-warning-test.yaml"
  ]);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /WARNING \[S004\]/);
});

test("traits validate fails on unknown option", () => {
  const result = runCLI(["validate", "profiles/resolve.yaml", "--unknown"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown option "--unknown"/);
});
