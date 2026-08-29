export type ContinueWatchingCompleteMedia = {
  mediaType: "movie" | "tv";
  seasonNumber?: number;
  episodeNumber?: number;
  lastAiredSeason?: number;
  lastAiredEpisode?: number;
  showStatus?: string | null;
  hasNextEpisode?: boolean;
};

/** completed = whole show/movie is finished/ended; null = hide the continue-watching card only, status stays "watching" */
export type ContinueWatchingWatchlistStatus = "completed" | null;

function hasAiredEpisodeNumbers(media: ContinueWatchingCompleteMedia): boolean {
  return (
    typeof media.seasonNumber === "number" &&
    typeof media.episodeNumber === "number" &&
    typeof media.lastAiredSeason === "number" &&
    typeof media.lastAiredEpisode === "number"
  );
}

export function isLatestAiredEpisode(
  media: ContinueWatchingCompleteMedia,
): boolean {
  if (!hasAiredEpisodeNumbers(media)) {
    return false;
  }

  return (
    media.seasonNumber === media.lastAiredSeason &&
    media.episodeNumber === media.lastAiredEpisode
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function positiveInt(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

export function tvCompleteFieldsFromDetail(detail: {
  status?: string | null;
  last_episode_to_air?: unknown;
  next_episode_to_air?: unknown;
}): Pick<
  ContinueWatchingCompleteMedia,
  "lastAiredSeason" | "lastAiredEpisode" | "showStatus" | "hasNextEpisode"
> {
  const lastAired = isRecord(detail.last_episode_to_air)
    ? detail.last_episode_to_air
    : null;

  return {
    lastAiredSeason: lastAired
      ? positiveInt(lastAired.season_number)
      : undefined,
    lastAiredEpisode: lastAired
      ? positiveInt(lastAired.episode_number)
      : undefined,
    showStatus: typeof detail.status === "string" ? detail.status : null,
    hasNextEpisode: detail.next_episode_to_air != null,
  };
}

export function tvCompleteMediaFromRecord(
  record: Record<string, unknown>,
): ContinueWatchingCompleteMedia {
  return {
    mediaType: "tv",
    ...tvCompleteFieldsFromDetail({
      status: typeof record.status === "string" ? record.status : null,
      last_episode_to_air: record.last_episode_to_air,
      next_episode_to_air: record.next_episode_to_air,
    }),
  };
}

function isEndedOrCanceled(showStatus: string | null | undefined): boolean {
  if (typeof showStatus !== "string") {
    return false;
  }

  const normalized = showStatus.trim().toLowerCase();
  return (
    normalized === "ended" ||
    normalized === "canceled" ||
    normalized === "cancelled"
  );
}

export function watchlistStatusAfterComplete(
  media: ContinueWatchingCompleteMedia,
): ContinueWatchingWatchlistStatus {
  switch (media.mediaType) {
    case "movie":
      return "completed";
    case "tv": {
      if (!isLatestAiredEpisode(media)) {
        return null;
      }

      // Ended/Canceled wins over hasNextEpisode (finale already aired).
      if (isEndedOrCanceled(media.showStatus)) {
        return "completed";
      }

      // Caught up on an ongoing show: just hide the continue-watching card,
      // status stays "watching" until the show ends and the user marks it
      // completed. We don't have a "caught up" watchlist status.
      return null;
    }
    default: {
      const _exhaustive: never = media.mediaType;
      return _exhaustive;
    }
  }
}
