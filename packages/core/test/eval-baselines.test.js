import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadProfileFile, runOfflineBaselineScaffold } from "../dist/internal.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const PROFILES_DIR = path.join(ROOT, "profiles");

test("runOfflineBaselineScaffold is deterministic and returns tier1 deltas", () => {
  const profile = loadProfileFile(path.join(PROFILES_DIR, "resolve.yaml"));
  const samples = [
    { id: "s1", prompt: "My order is late.", response: "I understand. Here's what I can do." }
  ];

  const one = runOfflineBaselineScaffold(profile, samples, {
    compiledTier1Report: { average_score: 0.72 }
  });
  const two = runOfflineBaselineScaffold(profile, samples, {
    compiledTier1Report: { average_score: 0.72 }
  });

  assert.deepEqual(one, two);
  assert.equal(one.type, "offline-scaffold");
  assert.equal(one.deterministic, true);
  assert.equal(one.tier1.none.sample_count, 1);
  assert.equal(one.tier1.basic.sample_count, 1);
  assert.equal(typeof one.tier1.deltas.basic_vs_none, "number");
  assert.equal(typeof one.tier1.deltas.compiled_vs_none, "number");
  assert.equal(typeof one.tier1.deltas.compiled_vs_basic, "number");
});

test("runOfflineBaselineScaffold honors includeHelpfulness=false", () => {
  const profile = loadProfileFile(path.join(PROFILES_DIR, "resolve.yaml"));
  const samples = [{ id: "s1", response: "Short response" }];

  const report = runOfflineBaselineScaffold(profile, samples, {
    includeHelpfulness: false,
    compiledTier1Report: { average_score: 0.6 }
  });

  assert.equal(report.helpfulness_included, false);
  assert.equal(report.tier1.none.samples[0].checks.helpfulness.skipped, true);
  assert.equal(report.tier1.basic.samples[0].checks.helpfulness.skipped, true);
});
