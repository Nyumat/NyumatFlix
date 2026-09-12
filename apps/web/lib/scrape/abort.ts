type AbortSignalInput = AbortSignal | null | undefined;

export const isScrapeAborted = (signal?: AbortSignalInput): boolean =>
  signal?.aborted ?? false;

export const isAbortError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "name" in error &&
  (error.name === "AbortError" || error.name === "TimeoutError");

export const shouldRetryScrapeFetchAttempt = (
  signal?: AbortSignalInput,
): boolean => !isScrapeAborted(signal);

export const throwIfScrapeAborted = (signal?: AbortSignalInput): void => {
  if (isScrapeAborted(signal)) {
    throw new DOMException("Scrape aborted", "AbortError");
  }
};

export const anyAbortSignal = (
  first: AbortSignal,
  ...rest: AbortSignal[]
): AbortSignal => {
  const signals = [first, ...rest];
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any(signals);
  }

  const controller = new AbortController();
  const onAbort = () => controller.abort();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      return controller.signal;
    }
    signal.addEventListener("abort", onAbort, { once: true });
  }
  return controller.signal;
};
