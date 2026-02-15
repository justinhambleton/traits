import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
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

test("extends removal fixture applies explicit removals in merged output", () => {
  const result = resolveExtends(fixture("_extends-removal-test.yaml"), {
    bundledProfilesDir: PROFILES_DIR
  });

  assert.equal(result.diagnostics.warnings.length, 0);
  assert.equal(result.diagnostics.errors.length, 0);
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

test("array extends fixture merges parents left-to-right before child overlay", () => {
  const result = resolveExtends(fixture("_extends-array-child.yaml"), {
    bundledProfilesDir: PROFILES_DIR
  });

  assert.equal(result.diagnostics.errors.length, 0);
  assert.equal(result.diagnostics.warnings.length, 0);
  assert.equal(result.parentPaths.length, 3);
  assert.equal(path.basename(result.parentPaths[0]), "_extends-array-base.yaml");
  assert.equal(path.basename(result.parentPaths[1]), "_extends-array-domain.yaml");
  assert.equal(path.basename(result.parentPaths[2]), "_extends-array-channel.yaml");

  assert.equal(result.profile.voice.formality, "low");
  assert.equal(result.profile.voice.warmth, "very-high");
  assert.deepEqual(result.profile.behavioral_rules, [
    "Rule base safety",
    "Rule shared guidance",
    "Rule domain guardrails",
    "Rule channel delivery",
    "Rule child addition"
  ]);
  assert.deepEqual(result.profile.vocabulary.preferred_terms, [
    "base-term",
    "domain-term",
    "channel-term",
    "child-term"
  ]);
  assert.deepEqual(result.profile.vocabulary.forbidden_terms, [
    "base-forbidden",
    "domain-forbidden",
    "channel-forbidden",
    "child-forbidden"
  ]);

  const adaptationWhenKeys = result.profile.context_adaptations.map((adaptation) => adaptation.when);
  assert.deepEqual(adaptationWhenKeys, ["shared", "base_only", "domain_only", "child_only"]);
  const shared = result.profile.context_adaptations.find((adaptation) => adaptation.when === "shared");
  assert.deepEqual(shared.inject, ["shared inject from child"]);
});

test("locked behavioral rules survive explicit child removals during merge", () => {
  const result = resolveExtends(fixture("_extends-locked-removal-test.yaml"), {
    bundledProfilesDir: PROFILES_DIR
  });

  assert.equal(result.diagnostics.errors.length, 0);
  assert.equal(result.diagnostics.warnings.length, 0);

  const rules = result.profile.behavioral_rules;
  assert.equal(rules.length, 1);
  assert.deepEqual(rules[0], {
    rule: "Never claim actions without tool confirmation",
    locked: true
  });
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
