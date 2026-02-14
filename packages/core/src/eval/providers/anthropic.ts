import {
  normalizeProviderRuntimeOptions,
  requestTextWithRetry
} from "./runtime.js";

const ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1";
type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

function parseJSONResponse(service: string, bodyText: string): any {
  try {
    return JSON.parse(bodyText);
  } catch {
    throw new Error(`${service} response was not valid JSON.`);
  }
}

export async function anthropicJudge({
  apiKey,
  systemPrompt,
  userPrompt,
  model = "claude-3-5-sonnet-latest",
  baseUrl = ANTHROPIC_BASE_URL,
  fetchImpl = fetch,
  timeoutMs,
  maxRetries,
  retryBaseMs
}: {
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  baseUrl?: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  maxRetries?: number;
  retryBaseMs?: number;
}): Promise<string> {
  if (!apiKey) {
    throw new Error("Missing Anthropic API key for judge request.");
  }

  const runtime = normalizeProviderRuntimeOptions({
    timeoutMs,
    maxRetries,
    retryBaseMs
  });

  const { bodyText } = await requestTextWithRetry({
    service: "Anthropic",
    url: `${baseUrl}/messages`,
    fetchImpl,
    timeoutMs: runtime.timeoutMs,
    maxRetries: runtime.maxRetries,
    retryBaseMs: runtime.retryBaseMs,
    init: {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model,
        max_tokens: 512,
        temperature: 0,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: userPrompt
          }
        ]
      })
    }
  });

  const data = parseJSONResponse("Anthropic judge", bodyText);
  const textBlock = Array.isArray(data?.content)
    ? data.content.find((item: any) => item?.type === "text")
    : null;
  const content = textBlock?.text;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("Anthropic judge response did not include text content.");
  }
  return content;
}
