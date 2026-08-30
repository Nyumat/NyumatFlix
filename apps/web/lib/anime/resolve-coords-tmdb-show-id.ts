import { isAnimeAnilistRouteId } from "@/lib/anilist-route-id";

/** AniList routes need mapped TMDB id in the store before coords can resolve. */
export const shouldAwaitPlaybackTmdbTvIdForMapping = (
  routeId: string,
  defaultAnilistId: number | null,
  playbackTmdbTvId: number | null,
): boolean =>
  defaultAnilistId != null &&
  playbackTmdbTvId == null &&
  isAnimeAnilistRouteId(routeId);

/**
 * TMDB show id for `/api/anime/playback-coords` — never an AniList route slug.
 * Returns null when the route id would collide with the AniList catalog id.
 */
export const resolveAnimeEpisodeMappingTmdbShowId = (
  routeId: string,
  defaultAnilistId: number | null,
  playbackTmdbTvId: number | null,
): number | null => {
  if (typeof playbackTmdbTvId === "number" && playbackTmdbTvId > 0) {
    return playbackTmdbTvId;
  }

  if (!defaultAnilistId) {
    const numeric = Number(routeId);
    return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
  }

  if (isAnimeAnilistRouteId(routeId)) {
    return null;
  }

  const numeric = Number(routeId);
  if (!Number.isInteger(numeric) || numeric <= 0) {
    return null;
  }

  if (defaultAnilistId > 0 && numeric === defaultAnilistId) {
    return null;
  }

  return numeric;
};
