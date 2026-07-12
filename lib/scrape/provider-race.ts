export const SCRAPE_RACE_CONCURRENCY = 3;
/** Covers typical 2Embed wins (~15s p50) without waiting out slow VidNest hangs. */
export const SCRAPE_ATTEMPT_TIMEOUT_MS = 18_000;

export type RaceBatchResult<T> = {
  batch: T[];
  nextIndex: number;
};

export function nextRaceBatch<T>(
  order: readonly T[],
  startIndex: number,
  failed: ReadonlySet<T>,
  concurrency = SCRAPE_RACE_CONCURRENCY,
): RaceBatchResult<T> {
  const batch: T[] = [];
  let index = Math.max(0, startIndex);

  while (index < order.length && batch.length < concurrency) {
    const providerId = order[index];
    index += 1;

    if (providerId === undefined || failed.has(providerId)) {
      continue;
    }

    batch.push(providerId);
  }

  return { batch, nextIndex: index };
}
