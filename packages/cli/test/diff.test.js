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

test("traits diff compares two profiles and shows changes", () => {
  const result = runCLI(["diff", "profiles/resolve.yaml", "profiles/haven.yaml"]);
  // exit code 1 means differences found
  assert.equal(result.status, 1);
  assert.match(result.stdout, /traits diff:/);
  assert.match(result.stdout, /Summary:/);
});

test("traits diff --json returns structured diff object", () => {
  const result = runCLI(["diff", "profiles/resolve.yaml", "profiles/haven.yaml", "--json"]);
  assert.equal(result.status, 1);
  const output = JSON.parse(result.stdout);
  assert.ok(Array.isArray(output.changes));
  assert.ok(typeof output.summary === "object");
  assert.ok(output.summary.added >= 0);
  assert.ok(output.summary.removed >= 0);
  assert.ok(output.summary.modified >= 0);
});

test("traits diff same profile returns exit code 0", () => {
  const result = runCLI(["diff", "profiles/resolve.yaml", "profiles/resolve.yaml"]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /No differences found/);
});

test("traits diff --resolved compares raw vs resolved profile", () => {
  const result = runCLI([
    "diff",
    "profiles/test-fixtures/_extends-safety-test.yaml",
    "--resolved"
  ]);
  // Should find differences between raw child and resolved (merged) version
  assert.equal(result.status, 1);
  assert.match(result.stdout, /\(raw\)/);
  assert.match(result.stdout, /\(resolved\)/);
});

test("traits diff with missing arguments shows usage", () => {
  const result = runCLI(["diff"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Expected two profile path arguments/);
});

test("traits diff --help shows usage", () => {
  const result = runCLI(["diff", "--help"]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage:/);
  assert.match(result.stdout, /--resolved/);
});
