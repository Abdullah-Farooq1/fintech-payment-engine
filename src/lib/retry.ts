export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  shouldRetry?: (error: any) => boolean;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 100,
  maxDelayMs: 5000,
};

// ── Transient DB errors worth retrying
const RETRYABLE_ERRORS = [
  "deadlock detected",
  "could not serialize",
  "connection terminated",
  "connection refused",
  "ECONNRESET",
  "ETIMEDOUT",
  "too many connections",
];

export const isRetryableError = (error: any): boolean => {
  const message = error?.message?.toLowerCase() ?? "";
  return RETRYABLE_ERRORS.some((e) => message.includes(e.toLowerCase()));
};

// ── Exponential backoff with jitter
const getDelay = (attempt: number, baseDelayMs: number, maxDelayMs: number): number => {
  const exponential = baseDelayMs * Math.pow(2, attempt - 1);
  const jitter = Math.random() * 100;
  return Math.min(exponential + jitter, maxDelayMs);
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// ── Main retry wrapper
export const withRetry = async <T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const shouldRetry = opts.shouldRetry ?? isRetryableError;

  let lastError: any;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      const retryable = shouldRetry(error);
      const hasMoreAttempts = attempt < opts.maxAttempts;

      if (!retryable || !hasMoreAttempts) {
        throw error;
      }

      const delay = getDelay(attempt, opts.baseDelayMs, opts.maxDelayMs);
      console.warn(
        `⚠️  Attempt ${attempt}/${opts.maxAttempts} failed: ${error.message}. Retrying in ${delay.toFixed(0)}ms...`
      );

      await sleep(delay);
    }
  }

  throw lastError;
};