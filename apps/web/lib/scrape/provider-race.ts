export const SCRAPE_RACE_CONCURRENCY = 3;
/** Covers typical 2Embed wins (~15s p50) without waiting out slow VidNest hangs. */
export const SCRAPE_ATTEMPT_TIMEOUT_MS = 18_000;
/** Direct SSE discovery cap when racing other scrapers in parallel. */
export const SCRAPE_DIRECT_ATTEMPT_TIMEOUT_MS = 45_000;
/** Longer budget when the user explicitly pinned Direct. */
const SCRAPE_DIRECT_PINNED_TIMEOUT_MS = 300_000;

/** Client-side attempt caps — shorter than upstream when failures are predictable. */
const PROVIDER_ATTEMPT_TIMEOUT_MS: Partial<Record<string, number>> = {
  vidrock: 8_000,
  "2embed": 25_000,
  bingr: 30_000,
  vidsrc: 20_000,
  vidnest: 30_000,
  videasy: 60_000,
  vidking: 30_000,
  animegg: 18_000,
  anizone: 20_000,
  kickassanime: 35_000,
  animeonsen: 15_000,
  anipm: 20_000,
};

export function getScrapeAttemptTimeoutMs(
  providerId: string,
  pinned = false,
): number {
  if (providerId === "direct") {
    return pinned
      ? SCRAPE_DIRECT_PINNED_TIMEOUT_MS
      : SCRAPE_DIRECT_ATTEMPT_TIMEOUT_MS;
  }

  const mapped = PROVIDER_ATTEMPT_TIMEOUT_MS[providerId];
  if (mapped !== undefined) {
    return mapped;
  }

  return SCRAPE_ATTEMPT_TIMEOUT_MS;
}

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

/** Prefer the highest-scoring provider; ties break on configured order. */
export function pickScoredRaceWinner<T extends string, TPayload>(
  order: readonly T[],
  settled: ReadonlyArray<RaceAttemptEntry<T, TPayload>>,
  scorePayload: (payload: TPayload) => number,
): RaceAttemptEntry<T, TPayload> | undefined {
  const successes = settled.filter(
    (
      entry,
    ): entry is RaceAttemptEntry<T, TPayload> & {
      attempt: { outcome: "success"; payload: TPayload };
    } =>
      entry.attempt.outcome === "success" &&
      entry.attempt.payload !== undefined,
  );

  if (successes.length === 0) {
    return undefined;
  }

  return successes.reduce((best, current) => {
    const bestScore = scorePayload(best.attempt.payload);
    const currentScore = scorePayload(current.attempt.payload);

    if (currentScore > bestScore) {
      return current;
    }

    if (currentScore < bestScore) {
      return best;
    }

    return order.indexOf(current.providerId) < order.indexOf(best.providerId)
      ? current
      : best;
  });
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

/** Move session-failed providers to the end while preserving relative order. */
export function deprioritizeProviders<T extends string>(
  order: readonly T[],
  failed: ReadonlySet<T>,
): readonly T[] {
  if (failed.size === 0) {
    return order;
  }

  const tail: T[] = [];
  const head: T[] = [];

  for (const providerId of order) {
    if (failed.has(providerId)) {
      tail.push(providerId);
    } else {
      head.push(providerId);
    }
  }

  return [...head, ...tail];
}

export function nextRaceBatch<T extends string>(
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
