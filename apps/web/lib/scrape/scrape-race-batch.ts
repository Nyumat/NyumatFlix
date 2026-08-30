import {
  pickRaceWinner,
  pickScoredRaceWinner,
  type RaceAttemptEntry,
} from "./provider-race";
import {
  payloadStartupProbePassed,
  type ScrapeStartupProbeFields,
} from "./playback-startup-score";

export type ScrapeCancelReason = "winner" | "timeout" | "run";

/** First success that satisfies hard playback preferences wins — no batch wait. */
export function shouldFinalizeFirstPreferenceMatch<T extends string, TPayload>(
  successes: ReadonlyArray<RaceAttemptEntry<T, TPayload>>,
  matchesPayload: (payload: TPayload) => boolean,
): RaceAttemptEntry<T, TPayload> | undefined {
  return successes.find(
    (
      entry,
    ): entry is RaceAttemptEntry<T, TPayload> & {
      attempt: { outcome: "success"; payload: TPayload };
    } =>
      entry.attempt.outcome === "success" &&
      entry.attempt.payload !== undefined &&
      matchesPayload(entry.attempt.payload),
  );
}

export const hasPendingStartupProbes = <T extends string, TPayload>(
  successes: ReadonlyArray<RaceAttemptEntry<T, TPayload>>,
): boolean =>
  successes.some(
    (entry) =>
      entry.attempt.outcome === "success" &&
      entry.attempt.payload !== undefined &&
      (entry.attempt.payload as ScrapeStartupProbeFields).startupProbeOk ===
        undefined,
  );

/** Pref match plus a successful client startup probe (master → first segment). */
export function shouldFinalizeFirstPreferenceMatchWithStartup<
  T extends string,
  TPayload extends ScrapeStartupProbeFields,
>(
  successes: ReadonlyArray<RaceAttemptEntry<T, TPayload>>,
  matchesPayload: (payload: TPayload) => boolean,
): RaceAttemptEntry<T, TPayload> | undefined {
  return successes.find(
    (
      entry,
    ): entry is RaceAttemptEntry<T, TPayload> & {
      attempt: { outcome: "success"; payload: TPayload };
    } =>
      entry.attempt.outcome === "success" &&
      entry.attempt.payload !== undefined &&
      matchesPayload(entry.attempt.payload) &&
      payloadStartupProbePassed(entry.attempt.payload),
  );
}

export function shouldFinalizeBatchWinner<T extends string, TPayload>(
  order: readonly T[],
  successes: ReadonlyArray<RaceAttemptEntry<T, TPayload>>,
  pending: ReadonlySet<T>,
  scorePayload?: (payload: TPayload) => number,
  waitForStartupProbes = false,
): RaceAttemptEntry<T, TPayload> | undefined {
  if (scorePayload && pending.size > 0) {
    return undefined;
  }

  if (waitForStartupProbes && hasPendingStartupProbes(successes)) {
    return undefined;
  }

  const winnerEntry = scorePayload
    ? pickScoredRaceWinner(order, successes, scorePayload)
    : pickRaceWinner(order, successes);
  if (!winnerEntry?.attempt.payload) {
    return undefined;
  }

  if (scorePayload) {
    return winnerEntry;
  }

  const hasEarlierPending = [...pending].some(
    (providerId) =>
      order.indexOf(providerId) < order.indexOf(winnerEntry.providerId),
  );
  if (hasEarlierPending) {
    return undefined;
  }

  return winnerEntry;
}

/** First provider in the batch to return a stream wins — best for full parallel races. */
export function shouldFinalizeRaceWinner<T extends string, TPayload>(
  successes: ReadonlyArray<RaceAttemptEntry<T, TPayload>>,
): RaceAttemptEntry<T, TPayload> | undefined {
  return successes.find((entry) => entry.attempt.payload);
}

export function classifySiblingCancel(
  reason: ScrapeCancelReason,
): "skipped" | "failure" | "ignored" {
  if (reason === "winner") {
    return "skipped";
  }
  if (reason === "timeout") {
    return "failure";
  }
  return "ignored";
}
