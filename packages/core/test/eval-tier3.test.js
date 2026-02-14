import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runTier3Evaluation, runTier3EvaluationForProfile } from "../dist/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const PROFILES_DIR = path.join(ROOT, "profiles");

test("runTier3Evaluation scores responses with custom judge function", async () => {
  const profile = {
    meta: { name: "resolve" },
    voice: {
      formality: "medium",
      warmth: "high",
      verbosity: "medium",
      directness: "high",
      empathy: "high",
      humor: "low"
    }
  };

  const report = await runTier3Evaluation(
    profile,
    [{ id: "sample-1", response: "I understand. Here's what I can do." }],
    {
      judgeFn: async () =>
        JSON.stringify({
          directness: 0.9,
          warmth_empathy_depth: 0.8,
          humor_appropriateness: 0.7,
          helpfulness: 0.85,
          rationale: "Good balance."
        })
    }
  );

  assert.equal(report.tier, 3);
  assert.equal(report.sample_count, 1);
  assert.equal(report.provider, "custom");
  assert.ok(report.average_score > 0.7);
});

test("runTier3EvaluationForProfile throws unavailable without provider keys", async () => {
  await assert.rejects(
    () =>
      runTier3EvaluationForProfile(
        path.join(PROFILES_DIR, "resolve.yaml"),
        [{ id: "sample", response: "response text" }],
        {
          bundledProfilesDir: PROFILES_DIR,
          openaiApiKey: "",
          anthropicApiKey: ""
        }
      ),
    (error) => {
      assert.equal(error.code, "E_EVAL_TIER3_UNAVAILABLE");
      return true;
    }
  );
});

test("runTier3EvaluationForProfile validates before scoring", async () => {
  await assert.rejects(
    () =>
      runTier3EvaluationForProfile(
        path.join(PROFILES_DIR, "test-fixtures/_unsafe-s001-test.yaml"),
        [{ id: "sample", response: "response text" }],
        { bundledProfilesDir: PROFILES_DIR, judgeFn: async () => "{}" }
      ),
    (error) => {
      assert.equal(error.code, "E_EVAL_VALIDATION");
      return true;
    }
  );
});

test("runTier3Evaluation auto provider prefers OpenAI and forwards model/base URL", async () => {
  const profile = {
    meta: { name: "resolve" },
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
  const report = await runTier3Evaluation(
    profile,
    [{ id: "sample-1", response: "I understand. Here's what I can do." }],
    {
      provider: "auto",
      openaiApiKey: "openai-key",
      anthropicApiKey: "anthropic-key",
      judgeModel: "gpt-4.1-mini",
      openaiBaseUrl: "https://openai.example/v1",
      fetchImpl: async (url, init) => {
        requests.push({ url, body: JSON.parse(init.body) });
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              choices: [
                {
                  message: {
                    content:
                      '{"directness":0.9,"warmth_empathy_depth":0.8,"humor_appropriateness":0.7,"helpfulness":0.85,"rationale":"Good."}'
                  }
                }
              ]
            })
        };
      }
    }
  );

  assert.equal(report.provider, "openai");
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://openai.example/v1/chat/completions");
  assert.equal(requests[0].body.model, "gpt-4.1-mini");
});

test("runTier3Evaluation supports disabling helpfulness scoring", async () => {
  const profile = {
    meta: { name: "resolve" },
    voice: {
      formality: "medium",
      warmth: "high",
      verbosity: "medium",
      directness: "high",
      empathy: "high",
      humor: "low"
    }
  };

  const report = await runTier3Evaluation(
    profile,
    [{ id: "sample-1", response: "I understand. Here's what I can do." }],
    {
      includeHelpfulness: false,
      judgeFn: async () =>
        JSON.stringify({
          directness: 0.9,
          warmth_empathy_depth: 0.8,
          humor_appropriateness: 0.7,
          rationale: "Good balance."
        })
    }
  );

  assert.equal(report.helpfulness_included, false);
  assert.equal(report.samples[0].helpfulness, null);
  assert.ok(report.average_score > 0.7);
});
