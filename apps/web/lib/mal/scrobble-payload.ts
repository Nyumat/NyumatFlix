import type { WatchlistStatus } from "@/lib/domain/watchlist";
import type { MalMyListStatus } from "./types";
import { mapWatchlistStatusToMalStatus } from "./status-maps";

export type MalScrobbleInput = {
  status?: WatchlistStatus;
  episodeNumber?: number;
  episodeCompleted?: boolean;
  currentListStatus: MalMyListStatus | null;
};

export function buildMalScrobblePayload(
  input: MalScrobbleInput,
): MalMyListStatus {
  const payload: MalMyListStatus = {};
  const currentStatus = input.currentListStatus?.status;

  if (input.status) {
    payload.status = mapWatchlistStatusToMalStatus(input.status);
  } else if (input.episodeNumber !== undefined) {
    if (currentStatus === "completed") {
      payload.is_rewatching = true;
    } else if (!currentStatus || currentStatus === "plan_to_watch") {
      payload.status = "watching";
    }
  }

  if (
    !input.episodeCompleted ||
    input.episodeNumber === undefined ||
    input.episodeNumber <= 0
  ) {
    return payload;
  }

  const currentWatched = input.currentListStatus?.num_episodes_watched;
  if (input.currentListStatus?.status === "completed") {
    if (
      typeof currentWatched !== "number" ||
      input.episodeNumber > currentWatched
    ) {
      payload.num_episodes_watched = input.episodeNumber;
    }
    return payload;
  }

  if (
    typeof currentWatched === "number" &&
    input.episodeNumber <= currentWatched
  ) {
    return payload;
  }

  payload.num_episodes_watched = input.episodeNumber;
  return payload;
}
