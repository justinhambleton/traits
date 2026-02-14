import {
  normalizeProviderRuntimeOptions,
  requestTextWithRetry
} from "./runtime.js";

const OPENAI_BASE_URL = "https://api.openai.com/v1";

function parseJSONResponse(service, bodyText) {
  try {
    return JSON.parse(bodyText);
  } catch {
    throw new Error(`${service} response was not valid JSON.`);
  }
}

export async function openAIEmbed({
  apiKey,
  input,
  model = "text-embedding-3-small",
  baseUrl = OPENAI_BASE_URL,
  fetchImpl = fetch,
  timeoutMs,
  maxRetries,
  retryBaseMs
}) {
  if (!apiKey) {
    throw new Error("Missing OpenAI API key for embedding request.");
  }

  const runtime = normalizeProviderRuntimeOptions({
    timeoutMs,
    maxRetries,
    retryBaseMs
  });

  const { bodyText } = await requestTextWithRetry({
    service: "OpenAI",
    url: `${baseUrl}/embeddings`,
    fetchImpl,
    timeoutMs: runtime.timeoutMs,
    maxRetries: runtime.maxRetries,
    retryBaseMs: runtime.retryBaseMs,
    init: {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        input
      })
    }
  });

  const data = parseJSONResponse("OpenAI embedding", bodyText);
  const embedding = data?.data?.[0]?.embedding;
  if (!Array.isArray(embedding)) {
    throw new Error("OpenAI embedding response did not include a valid embedding vector.");
  }
  return embedding;
}

export async function openAIJudge({
  apiKey,
  systemPrompt,
  userPrompt,
  model = "gpt-4o-mini",
  baseUrl = OPENAI_BASE_URL,
  fetchImpl = fetch,
  timeoutMs,
  maxRetries,
  retryBaseMs
}) {
  if (!apiKey) {
    throw new Error("Missing OpenAI API key for judge request.");
  }

  const runtime = normalizeProviderRuntimeOptions({
    timeoutMs,
    maxRetries,
    retryBaseMs
  });

  const { bodyText } = await requestTextWithRetry({
    service: "OpenAI",
    url: `${baseUrl}/chat/completions`,
    fetchImpl,
    timeoutMs: runtime.timeoutMs,
    maxRetries: runtime.maxRetries,
    retryBaseMs: runtime.retryBaseMs,
    init: {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: userPrompt
          }
        ]
      })
    }
  });

  const data = parseJSONResponse("OpenAI judge", bodyText);
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("OpenAI judge response did not include message content.");
  }
  return content;
}
