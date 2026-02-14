const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_BASE_MS = 250;

const RETRYABLE_STATUSES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

type ProviderRuntimeOptions = {
  timeoutMs?: number;
  maxRetries?: number;
  retryBaseMs?: number;
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

function toNonNegativeInteger(value: unknown, fallback: number): number {
  if (value == null) return fallback;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

function shouldRetryStatus(status: unknown): boolean {
  return RETRYABLE_STATUSES.has(Number(status));
}

function shouldRetryError(error: unknown): boolean {
  if (!error) return false;
  if ((error as { retryable?: boolean }).retryable === true) return true;
  if ((error as { name?: string }).name === "AbortError") return true;
  if ((error as { name?: string }).name === "TypeError") return true; // fetch network failures
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildDelay(attempt: number, baseMs: number): number {
  return Math.max(0, baseMs) * 2 ** attempt;
}

async function fetchWithTimeout(
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return fetchImpl(url, init);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetchImpl(url, {
      ...init,
      signal: controller.signal
    });
  } catch (error) {
    if ((error as { name?: string })?.name === "AbortError") {
      const timeoutError = new Error(`Request timed out after ${timeoutMs}ms.`);
      (timeoutError as Error & { code?: string; retryable?: boolean }).code =
        "E_PROVIDER_TIMEOUT";
      (timeoutError as Error & { code?: string; retryable?: boolean }).retryable = true;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function normalizeProviderRuntimeOptions(
  options: ProviderRuntimeOptions = {}
): { timeoutMs: number; maxRetries: number; retryBaseMs: number } {
  return {
    timeoutMs: toNonNegativeInteger(options.timeoutMs, DEFAULT_TIMEOUT_MS),
    maxRetries: toNonNegativeInteger(options.maxRetries, DEFAULT_MAX_RETRIES),
    retryBaseMs: toNonNegativeInteger(options.retryBaseMs, DEFAULT_RETRY_BASE_MS)
  };
}

export async function requestTextWithRetry({
  service,
  url,
  init,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxRetries = DEFAULT_MAX_RETRIES,
  retryBaseMs = DEFAULT_RETRY_BASE_MS
}: {
  service: string;
  url: string;
  init: RequestInit;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  maxRetries?: number;
  retryBaseMs?: number;
}): Promise<{ response: Response; bodyText: string }> {
  const normalized = normalizeProviderRuntimeOptions({
    timeoutMs,
    maxRetries,
    retryBaseMs
  });

  for (let attempt = 0; attempt <= normalized.maxRetries; attempt += 1) {
    try {
      const response = await fetchWithTimeout(fetchImpl, url, init, normalized.timeoutMs);
      const bodyText = await response.text();
      if (response.ok) {
        return { response, bodyText };
      }

      const requestError = new Error(
        `${service} request failed (${response.status}): ${bodyText}`
      );
      (requestError as Error & { status?: number; retryable?: boolean }).status =
        response.status;
      (requestError as Error & { status?: number; retryable?: boolean }).retryable =
        shouldRetryStatus(response.status);
      throw requestError;
    } catch (error) {
      const shouldRetry =
        attempt < normalized.maxRetries && shouldRetryError(error) === true;
      if (!shouldRetry) {
        throw error;
      }
      await sleep(buildDelay(attempt, normalized.retryBaseMs));
    }
  }

  throw new Error(`${service} request failed after retries.`);
}
