import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runTier2Evaluation, runTier2EvaluationForProfile } from "../dist/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const PROFILES_DIR = path.join(ROOT, "profiles");

function fakeEmbedding(text) {
  const input = String(text ?? "");
  let sum = 0;
  let vowels = 0;
  for (const ch of input.toLowerCase()) {
    sum += ch.charCodeAt(0);
    if ("aeiou".includes(ch)) vowels += 1;
  }
  return Promise.resolve([
    (sum % 997) / 997,
    Math.min(1, input.length / 200),
    Math.min(1, vowels / 80)
  ]);
}

test("runTier2Evaluation computes deterministic tier 2 scores with mock embeddings", async () => {
  const profile = {
    voice: {
      formality: "medium",
      warmth: "high",
      verbosity: "medium",
      directness: "high",
      empathy: "high",
      humor: "low"
    },
    meta: { description: "Support assistant" }
  };

  const report = await runTier2Evaluation(
    profile,
    [{ id: "sample-1", response: "I understand the issue. Here's what I can do." }],
    { embeddingFn: fakeEmbedding }
  );

  assert.equal(report.tier, 2);
  assert.equal(report.sample_count, 1);
  assert.ok(report.average_score >= 0 && report.average_score <= 1);
  assert.ok(report.dimension_averages.warmth >= 0);
});

test("runTier2EvaluationForProfile throws unavailable without OpenAI key or embeddingFn", async () => {
  await assert.rejects(
    () =>
      runTier2EvaluationForProfile(
        path.join(PROFILES_DIR, "resolve.yaml"),
        [{ id: "sample", response: "response text" }],
        { bundledProfilesDir: PROFILES_DIR, openaiApiKey: "" }
      ),
    (error) => {
      assert.equal(error.code, "E_EVAL_TIER2_UNAVAILABLE");
      return true;
    }
  );
});

test("runTier2EvaluationForProfile validates before scoring", async () => {
  await assert.rejects(
    () =>
      runTier2EvaluationForProfile(
        path.join(PROFILES_DIR, "test-fixtures/_unsafe-s001-test.yaml"),
        [{ id: "sample", response: "response text" }],
        { bundledProfilesDir: PROFILES_DIR, embeddingFn: fakeEmbedding }
      ),
    (error) => {
      assert.equal(error.code, "E_EVAL_VALIDATION");
      return true;
    }
  );
});

test("runTier2Evaluation uses configured OpenAI model and base URL", async () => {
  const profile = {
    voice: {
      formality: "medium",
      warmth: "high",
      verbosity: "medium",
      directness: "high",
      empathy: "high",
      humor: "low"
    }
  };

  const requests = [];
  const report = await runTier2Evaluation(
    profile,
    [{ id: "sample-1", response: "I can help with that." }],
    {
      openaiApiKey: "test-key",
      embeddingModel: "text-embedding-3-large",
      openaiBaseUrl: "https://openai.example/v1",
      fetchImpl: async (url, init) => {
        requests.push({ url, body: JSON.parse(init.body) });
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ data: [{ embedding: [0.1, 0.2, 0.3] }] })
        };
      }
    }
  );

  assert.equal(report.provider, "openai");
  assert.ok(requests.length > 0);
  assert.equal(requests[0].url, "https://openai.example/v1/embeddings");
  assert.equal(requests[0].body.model, "text-embedding-3-large");
});

test("runTier2Evaluation supports disabling helpfulness weighting", async () => {
  const profile = {
    voice: {
      formality: "medium",
      warmth: "high",
      verbosity: "medium",
      directness: "high",
      empathy: "high",
      humor: "low"
    }
  };

  const report = await runTier2Evaluation(
    profile,
    [{ id: "sample-1", response: "I can help." }],
    {
      openaiApiKey: "test-key",
      includeHelpfulness: false,
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ data: [{ embedding: [0.2, 0.3, 0.4] }] })
      })
    }
  );

  assert.equal(report.helpfulness_included, false);
  assert.equal(report.helpfulness_average, null);
  assert.equal(report.samples[0].helpfulness_score, null);
});
