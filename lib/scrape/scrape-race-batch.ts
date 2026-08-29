import { pickRaceWinner, type RaceAttemptEntry } from "./provider-race";

export type ScrapeCancelReason = "winner" | "timeout" | "run";

export function shouldFinalizeBatchWinner<T extends string, TPayload>(
  order: readonly T[],
  successes: ReadonlyArray<RaceAttemptEntry<T, TPayload>>,
  pending: ReadonlySet<T>,
): RaceAttemptEntry<T, TPayload> | undefined {
  const winnerEntry = pickRaceWinner(order, successes);
  if (!winnerEntry?.attempt.payload) {
    return undefined;
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
