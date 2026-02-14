import test from "node:test";
import assert from "node:assert/strict";

import { runImportAnalysis, validateResolvedProfile } from "../src/index.js";

function makeResponse(status, bodyText) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => bodyText
  };
}

test("runImportAnalysis maps analysis JSON into a valid profile", async () => {
  const result = await runImportAnalysis("You are a customer support specialist.", {
    profileName: "imported-resolve",
    analysisFn: async () =>
      JSON.stringify({
        detected_role: "Customer resolution specialist",
        detected_dimensions: {
          formality: "medium",
          warmth: "high",
          verbosity: "medium",
          directness: "high",
          empathy: "high",
          humor: { level: "very-low", style: "none" }
        },
        detected_vocabulary: {
          preferred: ["I understand", "Here's what I can do"],
          forbidden: ["calm down"]
        },
        detected_behavioral_rules: [
          "Acknowledge emotion before troubleshooting",
          "Ask one question at a time"
        ],
        confidence: 0.9,
        notes: "Strong support language."
      })
  });

  assert.equal(result.provider, "custom");
  assert.equal(result.profile.meta.name, "imported-resolve");
  assert.equal(result.profile.voice.warmth, "high");
  assert.equal(result.profile.voice.humor.target, "very-low");
  assert.equal(result.profile.vocabulary.preferred_terms.length, 2);
  assert.match(result.yaml, /schema: v1.4/);

  const validation = validateResolvedProfile(result.profile);
  assert.equal(validation.isValid, true);
});

test("runImportAnalysis throws unavailable without provider credentials", async () => {
  await assert.rejects(
    () =>
      runImportAnalysis("You are helpful.", {
        openaiApiKey: "",
        anthropicApiKey: ""
      }),
    (error) => {
      assert.equal(error.code, "E_IMPORT_PROVIDER_UNAVAILABLE");
      return true;
    }
  );
});

test("runImportAnalysis forwards OpenAI import provider configuration", async () => {
  let request = null;
  const result = await runImportAnalysis("You are concise and technical.", {
    provider: "openai",
    openaiApiKey: "openai-key",
    model: "gpt-4.1-mini",
    openaiBaseUrl: "https://openai.example/v1",
    fetchImpl: async (url, init) => {
      request = { url, body: JSON.parse(init.body) };
      return makeResponse(
        200,
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  detected_role: "Technical assistant",
                  detected_dimensions: {
                    formality: "medium",
                    warmth: "low",
                    verbosity: "low",
                    directness: "high",
                    empathy: "medium",
                    humor: { level: "low", style: "dry" }
                  },
                  detected_vocabulary: { preferred: [], forbidden: [] },
                  detected_behavioral_rules: ["Lead with executable steps"],
                  confidence: 0.81,
                  notes: "Technical voice."
                })
              }
            }
          ]
        })
      );
    }
  });

  assert.equal(result.provider, "openai");
  assert.equal(request.url, "https://openai.example/v1/chat/completions");
  assert.equal(request.body.model, "gpt-4.1-mini");
});
