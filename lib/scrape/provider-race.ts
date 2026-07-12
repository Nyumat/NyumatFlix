export const SCRAPE_RACE_CONCURRENCY = 3;
/** Covers typical 2Embed wins (~15s p50) without waiting out slow VidNest hangs. */
export const SCRAPE_ATTEMPT_TIMEOUT_MS = 18_000;

/** Fast scrapers that often pass probes but fail in the player — never pin as preferred. */
export const UNTRUSTED_PREFERRED_SCRAPE_PROVIDERS = new Set<string>(["vixsrc"]);

export type RaceBatchResult<T> = {
  batch: T[];
  nextIndex: number;
};

export type RaceAttemptOutcome = "success" | "failure" | "cancelled";

export type RaceAttemptEntry<T extends string, TPayload> = {
  providerId: T;
  attempt: { outcome: RaceAttemptOutcome; payload?: TPayload };
};

/** Prefer the earliest provider in order when several in a batch succeed. */
export function pickRaceWinner<T extends string, TPayload>(
  order: readonly T[],
  settled: ReadonlyArray<RaceAttemptEntry<T, TPayload>>,
): RaceAttemptEntry<T, TPayload> | undefined {
  const successes = settled.filter(
    (entry) => entry.attempt.outcome === "success",
  );
  if (successes.length === 0) {
    return undefined;
  }

  return successes.reduce((best, current) =>
    order.indexOf(current.providerId) < order.indexOf(best.providerId)
      ? current
      : best,
  );
}

/** Pin a remembered provider to the front without skipping the rest of the chain. */
export function reorderProvidersWithPreferred<T extends string>(
  order: readonly T[],
  preferred: T | undefined,
): readonly T[] {
  if (!preferred || !order.includes(preferred)) {
    return order;
  }

  return [preferred, ...order.filter((id) => id !== preferred)];
}

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
