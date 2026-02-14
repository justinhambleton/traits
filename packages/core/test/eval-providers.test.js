import test from "node:test";
import assert from "node:assert/strict";

import { anthropicJudge } from "../src/eval/providers/anthropic.js";
import { openAIEmbed, openAIJudge } from "../src/eval/providers/openai.js";

function makeResponse(status, bodyText) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => bodyText
  };
}

test("openAIEmbed retries transient status errors", async () => {
  let attempts = 0;

  const embedding = await openAIEmbed({
    apiKey: "test-key",
    input: "sample",
    maxRetries: 2,
    retryBaseMs: 0,
    fetchImpl: async () => {
      attempts += 1;
      if (attempts === 1) {
        return makeResponse(429, "rate limited");
      }
      return makeResponse(
        200,
        JSON.stringify({
          data: [{ embedding: [0.11, 0.22, 0.33] }]
        })
      );
    }
  });

  assert.equal(attempts, 2);
  assert.deepEqual(embedding, [0.11, 0.22, 0.33]);
});

test("openAIJudge does not retry non-retryable status", async () => {
  let attempts = 0;

  await assert.rejects(
    () =>
      openAIJudge({
        apiKey: "test-key",
        systemPrompt: "system",
        userPrompt: "user",
        maxRetries: 3,
        retryBaseMs: 0,
        fetchImpl: async () => {
          attempts += 1;
          return makeResponse(400, "bad request");
        }
      }),
    /OpenAI request failed \(400\): bad request/
  );

  assert.equal(attempts, 1);
});

test("anthropicJudge retries network errors", async () => {
  let attempts = 0;

  const content = await anthropicJudge({
    apiKey: "test-key",
    systemPrompt: "system",
    userPrompt: "user",
    maxRetries: 2,
    retryBaseMs: 0,
    fetchImpl: async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new TypeError("network down");
      }
      return makeResponse(
        200,
        JSON.stringify({
          content: [{ type: "text", text: "{\"directness\": 0.9}" }]
        })
      );
    }
  });

  assert.equal(attempts, 2);
  assert.equal(content, "{\"directness\": 0.9}");
});
