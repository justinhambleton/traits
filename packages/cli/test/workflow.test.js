import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const CLI_ENTRY = path.join(ROOT, "packages/cli/src/bin/traits.js");

function runCLI(args) {
  return spawnSync(process.execPath, [CLI_ENTRY, ...args], {
    cwd: ROOT,
    encoding: "utf8"
  });
}

test("workflow: traits init -> traits validate -> traits compile", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "traits-workflow-"));
  const profilePath = path.join(tmpDir, "workflow-profile.yaml");
  try {
    const initResult = runCLI([
      "init",
      profilePath,
      "--name",
      "workflow-profile",
      "--domain",
      "customer-support",
      "--model",
      "claude-sonnet",
      "--tone",
      "balanced"
    ]);
    assert.equal(initResult.status, 0);

    const validateResult = runCLI(["validate", profilePath]);
    assert.equal(validateResult.status, 0);
    assert.match(validateResult.stdout, /Profile is valid\./);

    const compileResult = runCLI([
      "compile",
      profilePath,
      "--model",
      "claude-sonnet",
      "--explain"
    ]);
    assert.equal(compileResult.status, 0);
    assert.match(compileResult.stdout, /\[TRAITS PERSONALITY\]/);
    assert.match(compileResult.stdout, /\[TRACE\]/);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
