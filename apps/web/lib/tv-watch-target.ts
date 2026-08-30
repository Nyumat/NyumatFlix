import type { WatchlistItem } from "@/lib/domain/watchlist";
import type { Episode } from "@/lib/domain/typings";
import {
  fromAnilistTvRouteId,
  isAnilistTvRouteId,
} from "@/lib/anilist-route-id";
import {
  getLatestTvPlaybackCoords,
  getPlaybackProgress,
  getRememberedLastTvEpisode,
  resolveResumeTime,
  type TvEpisodeCoords,
} from "@/lib/playback/progress-storage";
import { getVidsrcLastTvEpisode } from "@/lib/playback/recently-watched";

export const normalizeTvContentKey = (id: string | number): number | null => {
  const asString = String(id);
  if (isAnilistTvRouteId(asString)) {
    return fromAnilistTvRouteId(asString);
  }

  const parsed = Number(asString);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export type TvWatchTarget =
  | { source: "selection"; episode: Episode; seasonNumber: number }
  | {
      source: "watchlist" | "progress";
      seasonNumber: number;
      episodeNumber: number;
    }
  | { source: "initial"; episode: Episode; seasonNumber: number };

export type TvWatchTargetState = {
  selectedEpisode: Episode | null;
  tvShowId: string | null;
  seasonNumber: number | null;
};

export type LocalTvWatchCoords = {
  seasonNumber: number;
  episodeNumber: number;
};

const pickNewestTvCoords = (
  candidates: Array<TvEpisodeCoords | null>,
): LocalTvWatchCoords | null => {
  const present = candidates.filter(
    (candidate): candidate is TvEpisodeCoords => candidate != null,
  );
  if (present.length === 0) {
    return null;
  }

  present.sort((left, right) => right.updatedAt - left.updatedAt);
  const newest = present[0];
  if (!newest) {
    return null;
  }

  return {
    seasonNumber: newest.seasonNumber,
    episodeNumber: newest.episodeNumber,
  };
};

export function resolveLocalTvWatchCoords(
  contentId: number,
): LocalTvWatchCoords | null {
  const contentKey = normalizeTvContentKey(contentId);
  if (contentKey === null) {
    return null;
  }

  return pickNewestTvCoords([
    getRememberedLastTvEpisode(contentKey),
    getLatestTvPlaybackCoords(contentKey),
    getVidsrcLastTvEpisode(contentKey),
  ]);
}

export function isTvCoordsWatchTarget(
  target: TvWatchTarget,
): target is Extract<TvWatchTarget, { episodeNumber: number }> {
  return target.source === "watchlist" || target.source === "progress";
}

export function resolveTvWatchTarget(
  contentId: number,
  state: TvWatchTargetState,
  watchlistItem?: WatchlistItem | null,
  initialEpisode?: Episode | null,
  initialSeasonNumber?: number | null,
  localCoords?: LocalTvWatchCoords | null,
): TvWatchTarget | null {
  const contentKey = normalizeTvContentKey(contentId);

  const stateKey = normalizeTvContentKey(state.tvShowId ?? "");
  const storeMatchesContent = contentKey !== null && stateKey === contentKey;

  if (
    state.selectedEpisode &&
    storeMatchesContent &&
    state.seasonNumber != null
  ) {
    return {
      source: "selection",
      episode: state.selectedEpisode,
      seasonNumber: state.seasonNumber,
    };
  }

  if (
    storeMatchesContent &&
    state.seasonNumber != null &&
    state.selectedEpisode === null
  ) {
    return null;
  }

  if (localCoords?.seasonNumber && localCoords.episodeNumber) {
    return {
      source: "progress",
      seasonNumber: localCoords.seasonNumber,
      episodeNumber: localCoords.episodeNumber,
    };
  }

  if (watchlistItem?.lastWatchedSeason && watchlistItem?.lastWatchedEpisode) {
    return {
      source: "watchlist",
      seasonNumber: watchlistItem.lastWatchedSeason,
      episodeNumber: watchlistItem.lastWatchedEpisode,
    };
  }

  if (initialEpisode && initialSeasonNumber) {
    return {
      source: "initial",
      episode: initialEpisode,
      seasonNumber: initialSeasonNumber,
    };
  }

  return null;
}

export function tvWatchTargetCoords(target: TvWatchTarget): {
  seasonNumber: number;
  episodeNumber: number;
} {
  return {
    seasonNumber: target.seasonNumber,
    episodeNumber: isTvCoordsWatchTarget(target)
      ? target.episodeNumber
      : target.episode.episode_number,
  };
}

export function isTvWatchlistResume(
  target: TvWatchTarget,
  watchlistItem?: WatchlistItem | null,
): boolean {
  const { seasonNumber, episodeNumber } = tvWatchTargetCoords(target);

  return (
    watchlistItem?.lastWatchedSeason === seasonNumber &&
    watchlistItem?.lastWatchedEpisode === episodeNumber
  );
}

export function isTvPlaybackResume(
  target: TvWatchTarget,
  contentId: number,
): boolean {
  const { seasonNumber, episodeNumber } = tvWatchTargetCoords(target);
  const resumeTime = resolveResumeTime(
    getPlaybackProgress({
      mediaType: "tv",
      contentId,
      seasonNumber,
      episodeNumber,
    }),
  );

  return resumeTime > 0;
}

export function formatTvWatchLabel(
  target: TvWatchTarget,
  display?: {
    seasonNumber?: number | null;
    episodeNumber?: number | null;
  },
  options?: {
    resume?: boolean;
  },
): string {
  const seasonNumber = display?.seasonNumber ?? target.seasonNumber;
  const episodeNumber =
    display?.episodeNumber ?? tvWatchTargetCoords(target).episodeNumber;
  const verb = options?.resume ? "Resume" : "Watch";

  return `${verb} S${seasonNumber}E${episodeNumber}`;
}

export function isSameTvWatchTarget(
  target: TvWatchTarget,
  state: TvWatchTargetState,
  contentId: number,
): boolean {
  const contentKey = normalizeTvContentKey(contentId);
  const stateKey = normalizeTvContentKey(state.tvShowId ?? "");

  if (contentKey === null || stateKey === null || stateKey !== contentKey) {
    return false;
  }

  if (!state.selectedEpisode || state.seasonNumber == null) {
    return false;
  }

  if (isTvCoordsWatchTarget(target)) {
    return (
      state.seasonNumber === target.seasonNumber &&
      state.selectedEpisode.episode_number === target.episodeNumber
    );
  }

  return (
    state.seasonNumber === target.seasonNumber &&
    state.selectedEpisode.id === target.episode.id
  );
}
