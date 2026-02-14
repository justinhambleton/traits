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

function withTempDir(fn) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "traits-cli-init-"));
  try {
    return fn(tmpDir);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

test("traits init generates scaffold that passes traits validate", () => {
  withTempDir((tmpDir) => {
    const outputPath = path.join(tmpDir, "support-profile.yaml");
    const initResult = runCLI([
      "init",
      outputPath,
      "--name",
      "support-profile",
      "--domain",
      "customer-support",
      "--model",
      "claude-sonnet",
      "--tone",
      "balanced"
    ]);

    assert.equal(initResult.status, 0);
    assert.match(initResult.stdout, /Created profile scaffold/);
    assert.equal(fs.existsSync(outputPath), true);

    const validateResult = runCLI(["validate", outputPath]);
    assert.equal(validateResult.status, 0);
    assert.match(validateResult.stdout, /Profile is valid\./);
  });
});

test("traits init --template copies starter profile and validates", () => {
  withTempDir((tmpDir) => {
    const outputPath = path.join(tmpDir, "resolve-template.yaml");
    const initResult = runCLI(["init", outputPath, "--template", "resolve"]);

    assert.equal(initResult.status, 0);
    assert.match(initResult.stdout, /Created profile from template/);

    const generated = fs.readFileSync(outputPath, "utf8");
    assert.match(generated, /name: "resolve"/);

    const validateResult = runCLI(["validate", outputPath]);
    assert.equal(validateResult.status, 0);
  });
});

test("traits init fails if output exists without --force", () => {
  withTempDir((tmpDir) => {
    const outputPath = path.join(tmpDir, "existing.yaml");
    fs.writeFileSync(outputPath, "schema: \"v1.4\"\n", "utf8");

    const initResult = runCLI([
      "init",
      outputPath,
      "--name",
      "existing",
      "--domain",
      "general",
      "--model",
      "claude-sonnet",
      "--tone",
      "balanced"
    ]);

    assert.equal(initResult.status, 1);
    assert.match(initResult.stderr, /File already exists/);
  });
});
