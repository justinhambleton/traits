import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";

import { resolveActiveContext, resolveExtends } from "../dist/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const PROFILES_DIR = path.join(ROOT, "profiles");
const FIXTURES_DIR = path.join(PROFILES_DIR, "test-fixtures");

function fixture(name) {
  return path.join(FIXTURES_DIR, name);
}

test("extends safety fixture preserves parent safety arrays and appends child", () => {
  const result = resolveExtends(fixture("_extends-safety-test.yaml"), {
    bundledProfilesDir: PROFILES_DIR
  });

  assert.equal(result.diagnostics.errors.length, 0);
  assert.equal(result.diagnostics.warnings.length, 0);
  assert.equal(result.profile.behavioral_rules.length, 6);
  assert.equal(result.profile.vocabulary.forbidden_terms.length, 6);
  assert.ok(
    result.profile.behavioral_rules.includes(
      "Always recommend the user log symptoms before their next appointment"
    )
  );
  assert.ok(result.profile.vocabulary.forbidden_terms.includes("it'll pass"));
});

test("extends removal fixture emits S006 warnings and regression error", () => {
  const result = resolveExtends(fixture("_extends-removal-test.yaml"), {
    bundledProfilesDir: PROFILES_DIR
  });

  const warningCodes = result.diagnostics.warnings.map((d) => d.code);
  const errorCodes = result.diagnostics.errors.map((d) => d.code);

  assert.ok(warningCodes.includes("S006"));
  assert.ok(errorCodes.includes("S006"));
  assert.equal(result.profile.behavioral_rules.length, 2);
  assert.deepEqual(result.profile.vocabulary.forbidden_terms, [
    "unfortunately",
    "calm down"
  ]);
});

test("context adaptation merge fixture replaces same when and appends new keys", () => {
  const result = resolveExtends(fixture("_extends-adaptation-test.yaml"), {
    bundledProfilesDir: PROFILES_DIR
  });

  assert.equal(result.diagnostics.errors.length, 0);
  const whenKeys = result.profile.context_adaptations.map((a) => a.when);
  assert.deepEqual(whenKeys, [
    "frustrated_user",
    "confused_user",
    "returning_user",
    "vip_user",
    "compliance_audit"
  ]);

  const vip = result.profile.context_adaptations.find((a) => a.when === "vip_user");
  assert.ok(vip.inject.some((line) => line.includes("dedicated account manager")));
});

test("S007 warns when safety adaptation has missing/zero priority", () => {
  const result = resolveExtends(path.join(PROFILES_DIR, "haven.yaml"), {
    bundledProfilesDir: PROFILES_DIR
  });
  assert.equal(result.diagnostics.warnings.length, 0);

  const tmpFile = path.join(os.tmpdir(), `traits-s007-${Date.now()}.yaml`);
  const yaml = `
schema: "v1.4"
meta:
  name: "s007-check"
  version: "1.0.0"
  description: "synthetic"
identity:
  role: "synthetic"
voice:
  formality: "medium"
  warmth: "medium"
  verbosity: "medium"
  directness: "medium"
  empathy: "medium"
  humor: "low"
context_adaptations:
  - when: "crisis_indicators"
    inject:
      - "Do crisis flow now"
  - when: "emergency_path"
    priority: 0
    inject:
      - "Call emergency services"
`;
  fs.writeFileSync(tmpFile, yaml, "utf8");
  try {
    const s007 = resolveExtends(tmpFile, { bundledProfilesDir: PROFILES_DIR });
    const s007Warnings = s007.diagnostics.warnings.filter((d) => d.code === "S007");
    assert.equal(s007Warnings.length, 2);
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

test("context conflict semantics apply priority then array-order with deterministic output", () => {
  const haven = resolveExtends(path.join(PROFILES_DIR, "haven.yaml"), {
    bundledProfilesDir: PROFILES_DIR
  }).profile;

  const resolved = resolveActiveContext(haven, {
    newly_diagnosed: true,
    crisis_indicators: true
  });

  assert.equal(resolved.matched.length, 2);
  assert.equal(resolved.resolvedAdjustments.directness.target, "medium");
  assert.ok(resolved.injectRules[0].includes("Go slow"));
  assert.ok(resolved.injectRules[1].includes("Check understanding"));
  assert.ok(resolved.injectRules[2].includes("Provide crisis resources"));
});
