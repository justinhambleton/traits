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
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "traits-cli-migrate-"));
  try {
    return fn(tmpDir);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function writeV14Profile(filePath) {
  fs.writeFileSync(
    filePath,
    [
      'schema: "v1.4"',
      "",
      "meta:",
      '  name: "migrate-test"',
      '  version: "1.0.0"',
      '  description: "migration fixture"',
      "",
      "identity:",
      '  role: "Migration fixture"',
      "",
      "voice:",
      '  formality: "medium"',
      '  warmth: "medium"',
      '  verbosity: "medium"',
      '  directness: "medium"',
      '  empathy: "medium"',
      "  humor:",
      '    target: "low"',
      '    style: "dry"',
      "",
      "behavioral_rules:",
      '  - "Keep responses clear"',
      ""
    ].join("\n"),
    "utf8"
  );
}

function writeV15Profile(filePath, options = {}) {
  const extendsValue = options.extendsValue ?? null;
  const extendsBlock =
    typeof extendsValue === "string"
      ? [`extends: "${extendsValue}"`, ""]
      : [];

  fs.writeFileSync(
    filePath,
    [
      'schema: "v1.5"',
      "",
      ...extendsBlock,
      "meta:",
      '  name: "migrate-test-v1-5"',
      '  version: "1.0.0"',
      '  description: "migration fixture"',
      "",
      "identity:",
      '  role: "Migration fixture"',
      "",
      "voice:",
      '  formality: "medium"',
      '  warmth: "medium"',
      '  verbosity: "medium"',
      '  directness: "medium"',
      '  empathy: "medium"',
      "  humor:",
      '    target: "low"',
      '    style: "dry"',
      "",
      "behavioral_rules:",
      '  - "Keep responses clear"',
      "",
      "capabilities:",
      "  tools:",
      '    - "ticket_lookup"',
      "  constraints:",
      '    - "Never claim completed actions without tool confirmation."',
      "  handoff:",
      '    trigger: "Tooling unavailable"',
      '    action: "Offer handoff."',
      ""
    ].join("\n"),
    "utf8"
  );
}

test("traits migrate upgrades v1.4 profile to v1.6 non-destructively by default", () => {
  withTempDir((tmpDir) => {
    const inputPath = path.join(tmpDir, "profile.yaml");
    writeV14Profile(inputPath);

    const result = runCLI(["migrate", inputPath]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Migrated profile schema v1.4 -> v1.6/);

    const outputPath = path.join(tmpDir, "profile.v1.6.yaml");
    assert.equal(fs.existsSync(outputPath), true);

    const original = fs.readFileSync(inputPath, "utf8");
    const migrated = fs.readFileSync(outputPath, "utf8");
    assert.match(original, /schema: "v1\.4"/);
    assert.match(migrated, /schema: v1\.6/);
    assert.match(migrated, /capabilities:/);
  });
});

test("traits migrate supports explicit --to v1.5 from v1.4", () => {
  withTempDir((tmpDir) => {
    const inputPath = path.join(tmpDir, "explicit-v15.yaml");
    writeV14Profile(inputPath);

    const result = runCLI(["migrate", inputPath, "--to", "v1.5"]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Migrated profile schema v1.4 -> v1.5/);

    const outputPath = path.join(tmpDir, "explicit-v15.v1.5.yaml");
    assert.equal(fs.existsSync(outputPath), true);
    const migrated = fs.readFileSync(outputPath, "utf8");
    assert.match(migrated, /schema: v1\.5/);
  });
});

test("traits migrate supports in-place overwrite with --force", () => {
  withTempDir((tmpDir) => {
    const inputPath = path.join(tmpDir, "in-place.yaml");
    writeV14Profile(inputPath);

    const result = runCLI(["migrate", inputPath, "--in-place", "--force"]);
    assert.equal(result.status, 0);
    const migrated = fs.readFileSync(inputPath, "utf8");
    assert.match(migrated, /schema: v1\.6/);
    assert.match(migrated, /capabilities:/);
  });
});

test("traits migrate --json emits structured output", () => {
  withTempDir((tmpDir) => {
    const inputPath = path.join(tmpDir, "json.yaml");
    writeV14Profile(inputPath);

    const result = runCLI(["migrate", inputPath, "--json"]);
    assert.equal(result.status, 0);

    const output = JSON.parse(result.stdout);
    assert.equal(output.migrated, true);
    assert.equal(output.fromSchema, "v1.4");
    assert.equal(output.toSchema, "v1.6");
    assert.equal(typeof output.outputPath, "string");
  });
});

test("traits migrate upgrades v1.5 profiles to v1.6 and preserves capabilities", () => {
  withTempDir((tmpDir) => {
    const inputPath = path.join(tmpDir, "v15.yaml");
    writeV15Profile(inputPath);

    const result = runCLI(["migrate", inputPath]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Migrated profile schema v1.5 -> v1.6/);

    const outputPath = path.join(tmpDir, "v15.v1.6.yaml");
    const migrated = fs.readFileSync(outputPath, "utf8");
    assert.match(migrated, /schema: v1\.6/);
    assert.match(migrated, /tools:\n\s+- ticket_lookup/);
    assert.match(migrated, /trigger: Tooling unavailable/);
  });
});

test("traits migrate --normalize-extends converts single-string extends on v1.6 target", () => {
  withTempDir((tmpDir) => {
    const inputPath = path.join(tmpDir, "normalize.yaml");
    writeV15Profile(inputPath, { extendsValue: "resolve" });

    const result = runCLI(["migrate", inputPath, "--normalize-extends"]);
    assert.equal(result.status, 0);

    const outputPath = path.join(tmpDir, "normalize.v1.6.yaml");
    const migrated = fs.readFileSync(outputPath, "utf8");
    assert.match(migrated, /extends:\n\s+- resolve/);
  });
});

test("traits migrate rejects --normalize-extends with --to v1.5", () => {
  withTempDir((tmpDir) => {
    const inputPath = path.join(tmpDir, "invalid-normalize.yaml");
    writeV14Profile(inputPath);

    const result = runCLI(["migrate", inputPath, "--to", "v1.5", "--normalize-extends"]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /--normalize-extends.*--to v1\.6/i);
  });
});

test("traits migrate rejects v1.6 source profiles", () => {
  withTempDir((tmpDir) => {
    const inputPath = path.join(tmpDir, "already-v16.yaml");
    writeV15Profile(inputPath);
    fs.writeFileSync(inputPath, fs.readFileSync(inputPath, "utf8").replace('schema: "v1.5"', 'schema: "v1.6"'));

    const result = runCLI(["migrate", inputPath]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /already at "v1\.6"/i);
  });
});
