import type { TvDetailCatalog } from "@/lib/tv-detail-catalog";

export type AnimeCoordsStatus = "idle" | "pending" | "resolved" | "miss";

export type AnimePlaybackHoldInput = {
  animeFirst: boolean;
  hasSelectedEpisode: boolean;
  animeCoordsReady: boolean;
  animeCoordsStatus: AnimeCoordsStatus;
};

/** `/anime/*` and other AniList-backed detail pages use anime scrapers first. */
export const isAnimeFirstPlayback = (
  catalog: TvDetailCatalog | null,
  defaultAnilistId: number | null,
): boolean => catalog === "anime" || defaultAnilistId != null;

/**
 * Hold scrape until we know the AniList episode. TMDB proxies only after a miss.
 */
export const shouldHoldAnimePlaybackStart = (
  input: AnimePlaybackHoldInput,
): boolean => {
  if (!input.animeFirst || !input.hasSelectedEpisode) {
    return false;
  }

  if (input.animeCoordsReady) {
    return false;
  }

  return input.animeCoordsStatus !== "miss";
};

/** Plain TV/TMDB scrape is only allowed when coords could not be resolved. */
export const shouldAllowTmdbOnlyScrape = (
  input: AnimePlaybackHoldInput,
): boolean => {
  if (!input.animeFirst || !input.hasSelectedEpisode) {
    return true;
  }

  return input.animeCoordsStatus === "miss" && !input.animeCoordsReady;
};

export const ANIME_PLAYBACK_RESOLVING_MESSAGE = "Resolving episode…";
