import {
  pickRaceWinner,
  pickScoredRaceWinner,
  type RaceAttemptEntry,
} from "./provider-race";

export type ScrapeCancelReason = "winner" | "timeout" | "run";

export function shouldFinalizeBatchWinner<T extends string, TPayload>(
  order: readonly T[],
  successes: ReadonlyArray<RaceAttemptEntry<T, TPayload>>,
  pending: ReadonlySet<T>,
  scorePayload?: (payload: TPayload) => number,
): RaceAttemptEntry<T, TPayload> | undefined {
  if (scorePayload && pending.size > 0) {
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
