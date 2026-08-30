export const isScrapeAborted = (signal?: AbortSignal): boolean =>
  signal?.aborted ?? false;

export const throwIfScrapeAborted = (signal?: AbortSignal): void => {
  if (isScrapeAborted(signal)) {
    throw new DOMException("Scrape aborted", "AbortError");
  }
};
