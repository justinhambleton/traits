const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_BASE_MS = 250;

const RETRYABLE_STATUSES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

function toNonNegativeInteger(value, fallback) {
  if (value == null) return fallback;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

function shouldRetryStatus(status) {
  return RETRYABLE_STATUSES.has(Number(status));
}

function shouldRetryError(error) {
  if (!error) return false;
  if (error.retryable === true) return true;
  if (error.name === "AbortError") return true;
  if (error.name === "TypeError") return true; // fetch network failures
  return false;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildDelay(attempt, baseMs) {
  return Math.max(0, baseMs) * 2 ** attempt;
}

async function fetchWithTimeout(fetchImpl, url, init, timeoutMs) {
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
    if (error?.name === "AbortError") {
      const timeoutError = new Error(`Request timed out after ${timeoutMs}ms.`);
      timeoutError.code = "E_PROVIDER_TIMEOUT";
      timeoutError.retryable = true;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function normalizeProviderRuntimeOptions(options = {}) {
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
}) {
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
      requestError.status = response.status;
      requestError.retryable = shouldRetryStatus(response.status);
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
