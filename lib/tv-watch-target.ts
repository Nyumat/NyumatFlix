import type { WatchlistItem } from "@/lib/domain/watchlist";
import type { Episode } from "@/lib/domain/typings";

export type TvWatchTarget =
  | { source: "selection"; episode: Episode; seasonNumber: number }
  | { source: "watchlist"; seasonNumber: number; episodeNumber: number }
  | { source: "initial"; episode: Episode; seasonNumber: number };

export type TvWatchTargetState = {
  selectedEpisode: Episode | null;
  tvShowId: string | null;
  seasonNumber: number | null;
};

export function resolveTvWatchTarget(
  contentId: number,
  state: TvWatchTargetState,
  watchlistItem?: WatchlistItem | null,
  initialEpisode?: Episode | null,
  initialSeasonNumber?: number | null,
): TvWatchTarget | null {
  const contentIdStr = String(contentId);

  if (
    state.selectedEpisode &&
    state.tvShowId === contentIdStr &&
    state.seasonNumber != null
  ) {
    return {
      source: "selection",
      episode: state.selectedEpisode,
      seasonNumber: state.seasonNumber,
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

export function formatTvWatchLabel(target: TvWatchTarget): string {
  if (target.source === "watchlist") {
    return `Watch S${target.seasonNumber}E${target.episodeNumber}`;
  }

  return `Watch S${target.seasonNumber}E${target.episode.episode_number}`;
}

export function isSameTvWatchTarget(
  target: TvWatchTarget,
  state: TvWatchTargetState,
  contentId: number,
): boolean {
  const contentIdStr = String(contentId);

  if (
    state.tvShowId !== contentIdStr ||
    !state.selectedEpisode ||
    state.seasonNumber == null
  ) {
    return false;
  }

  if (target.source === "watchlist") {
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
