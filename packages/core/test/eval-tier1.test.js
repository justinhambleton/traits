import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  evaluateTier1Response,
  loadProfileFile,
  runTier1Evaluation,
  runTier1EvaluationForProfile,
  validateEvalScenario,
  validateEvalScenarios
} from "../dist/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const PROFILES_DIR = path.join(ROOT, "profiles");

function profileFile(name) {
  return path.join(PROFILES_DIR, name);
}

test("validateEvalScenario accepts valid scenario contract", () => {
  const scenario = {
    id: "standard-001",
    category: "standard",
    domain: "customer-support",
    messages: [{ role: "user", content: "I need help with a billing issue." }]
  };

  const result = validateEvalScenario(scenario);
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test("validateEvalScenarios reports invalid scenarios with index", () => {
  const scenarios = [
    {
      id: "ok",
      category: "standard",
      messages: [{ role: "user", content: "hello" }]
    },
    {
      id: "",
      category: "wrong",
      messages: [{ role: "tool", content: "" }]
    }
  ];

  const result = validateEvalScenarios(scenarios);
  assert.equal(result.valid, false);
  assert.equal(result.invalid.length, 1);
  assert.equal(result.invalid[0].index, 1);
});

test("evaluateTier1Response penalizes forbidden terms", () => {
  const profile = loadProfileFile(profileFile("resolve.yaml"));
  const safeResponse = "I understand the issue. Here's what I can do to fix it quickly.";
  const unsafeResponse =
    "Unfortunately, calm down while I investigate. Here's what I can do next.";

  const safe = evaluateTier1Response(profile, safeResponse);
  const unsafe = evaluateTier1Response(profile, unsafeResponse);

  assert.equal(safe.checks.vocabulary.forbidden_matched, 0);
  assert.ok(unsafe.checks.vocabulary.forbidden_matched > 0);
  assert.ok(safe.score > unsafe.score);
});

test("runTier1Evaluation returns aggregate score and per-sample results", () => {
  const profile = loadProfileFile(profileFile("resolve.yaml"));
  const report = runTier1Evaluation(profile, [
    { id: "a", response: "I understand. Here's what I can do to resolve this now." },
    { id: "b", response: "I can help. Here's what I can do next." }
  ]);

  assert.equal(report.tier, 1);
  assert.equal(report.sample_count, 2);
  assert.equal(report.samples.length, 2);
  assert.ok(report.average_score > 0);
  assert.ok(report.average_score <= 1);
});

test("runTier1Evaluation supports skipping helpfulness weighting", () => {
  const profile = loadProfileFile(profileFile("resolve.yaml"));
  const samples = [{ id: "short", response: "I understand. Here's what I can do." }];

  const withHelpfulness = runTier1Evaluation(profile, samples, {
    includeHelpfulness: true
  });
  const withoutHelpfulness = runTier1Evaluation(profile, samples, {
    includeHelpfulness: false
  });

  assert.equal(withHelpfulness.samples[0].checks.helpfulness.skipped, false);
  assert.equal(withoutHelpfulness.samples[0].checks.helpfulness.skipped, true);
  assert.equal(withoutHelpfulness.samples[0].checks.helpfulness.pass, true);
  assert.ok(withoutHelpfulness.samples[0].score >= 0);
  assert.ok(withoutHelpfulness.samples[0].score <= 1);
});

test("evaluateTier1Response grants partial coverage for multi-word preferred terms", () => {
  const profile = loadProfileFile(profileFile("educator.yaml"));
  const response = "Let us explore this together and test your reasoning step by step.";

  const scored = evaluateTier1Response(profile, response);
  assert.ok(scored.checks.vocabulary.preferred_total > 0);
  assert.ok(scored.checks.vocabulary.preferred_matched >= 1);
  assert.ok(scored.checks.vocabulary.preferred_coverage > 0);
});

test("evaluateTier1Response includes per-dimension diagnostics and differentiates directness", () => {
  const profile = loadProfileFile(profileFile("architect.yaml"));
  const directResponse =
    "Start by checking the null path. Step 1: verify the config load. The answer is to guard the undefined value.";
  const hedgedResponse =
    "Perhaps you might consider several possibilities. It could be configuration related, and it depends on startup timing.";

  const direct = evaluateTier1Response(profile, directResponse);
  const hedged = evaluateTier1Response(profile, hedgedResponse);

  assert.equal(direct.checks.dimensions.per_dimension.length, 6);
  const directnessDirect = direct.checks.dimensions.per_dimension.find(
    (entry) => entry.dimension === "directness"
  );
  const directnessHedged = hedged.checks.dimensions.per_dimension.find(
    (entry) => entry.dimension === "directness"
  );
  assert.ok(directnessDirect);
  assert.ok(directnessHedged);
  assert.ok(directnessDirect.score > directnessHedged.score);
});

test("clean responses without preferred terms no longer collapse to a fixed floor", () => {
  const profile = loadProfileFile(profileFile("resolve.yaml"));
  const empathetic =
    "I understand this is frustrating. Here is what to do next: check account activity and then retry.";
  const detached =
    "Per the documentation, refer to section 4 and follow the procedure as specified.";

  const one = evaluateTier1Response(profile, empathetic);
  const two = evaluateTier1Response(profile, detached);
  assert.notEqual(one.score, two.score);
});

test("runTier1EvaluationForProfile blocks invalid profiles", () => {
  assert.throws(
    () =>
      runTier1EvaluationForProfile(
        path.join(PROFILES_DIR, "test-fixtures/_unsafe-s001-test.yaml"),
        [{ id: "sample", response: "Any response" }],
        { bundledProfilesDir: PROFILES_DIR }
      ),
    (error) => {
      assert.equal(error.code, "E_EVAL_VALIDATION");
      return true;
    }
  );
});
