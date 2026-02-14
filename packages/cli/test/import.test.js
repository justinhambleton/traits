import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const CLI_ENTRY = path.join(ROOT, "packages/cli/dist/traits.js");

function runCLI(args, options = {}) {
  return spawnSync(process.execPath, [CLI_ENTRY, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    input: options.input,
    env: {
      ...process.env,
      ...options.env
    }
  });
}

test("traits import requires prompt path or stdin", () => {
  const result = runCLI(["import"]);
  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /Provide a prompt file path or pipe prompt text via stdin|Prompt source is empty/
  );
});

test("traits import returns unavailable without provider keys for file input", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "traits-import-"));
  const promptFile = path.join(tmpDir, "prompt.txt");
  fs.writeFileSync(promptFile, "You are a helpful assistant.", "utf8");

  try {
    const result = runCLI(["import", promptFile]);
    assert.equal(result.status, 2);
    assert.match(
      result.stderr,
      /Import requires TRAITS_OPENAI_API_KEY or TRAITS_ANTHROPIC_API_KEY/
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("traits import accepts stdin input path", () => {
  const result = runCLI(["import", "--provider", "auto"], {
    input: "You are concise and professional."
  });
  assert.equal(result.status, 2);
  assert.match(
    result.stderr,
    /Import requires TRAITS_OPENAI_API_KEY or TRAITS_ANTHROPIC_API_KEY/
  );
});

test("traits import rejects invalid numeric runtime flags", () => {
  const result = runCLI(["import", "--timeout-ms", "-5"], {
    input: "You are concise and professional."
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Invalid "--timeout-ms" value/);
});
