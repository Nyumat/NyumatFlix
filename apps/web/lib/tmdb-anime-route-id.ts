/**
 * TMDB-backed anime routes support `tmdb-{id}` or `tmdb-tv-{id}` or `tmdb-movie-{id}` under `/anime/`.
 */

export const TMDB_ANIME_ROUTE_PREFIX = "tmdb-";

export type ParsedTmdbAnimeRoute = {
  tmdbId: number;
  mediaType: "tv" | "movie";
};

export const isTmdbAnimeRouteId = (routeId: string): boolean => {
  if (!routeId.startsWith(TMDB_ANIME_ROUTE_PREFIX)) {
    return false;
  }

  const remainder = routeId.slice(TMDB_ANIME_ROUTE_PREFIX.length);
  if (/^\d+$/.test(remainder)) {
    return Number.parseInt(remainder, 10) > 0;
  }

  if (/^(tv|movie)-\d+$/.test(remainder)) {
    const parts = remainder.split("-");
    const id = parts[1];
    return id ? Number.parseInt(id, 10) > 0 : false;
  }

  return false;
};

export const parseTmdbAnimeRouteId = (
  routeId: string,
): ParsedTmdbAnimeRoute | null => {
  if (!isTmdbAnimeRouteId(routeId)) {
    return null;
  }

  const remainder = routeId.slice(TMDB_ANIME_ROUTE_PREFIX.length);
  if (/^\d+$/.test(remainder)) {
    const id = Number.parseInt(remainder, 10);
    return id > 0 ? { tmdbId: id, mediaType: "tv" } : null;
  }

  const match = remainder.match(/^(tv|movie)-(\d+)$/);
  if (match && match[1] && match[2]) {
    const mediaType = match[1] as "tv" | "movie";
    const tmdbId = Number.parseInt(match[2], 10);
    return tmdbId > 0 ? { tmdbId, mediaType } : null;
  }

  return null;
};

export const toTmdbAnimeRouteSlug = (
  tmdbId: number,
  mediaType: "tv" | "movie" = "tv",
): string => {
  const absId = Math.abs(tmdbId);
  return mediaType === "movie"
    ? `${TMDB_ANIME_ROUTE_PREFIX}movie-${absId}`
    : `${TMDB_ANIME_ROUTE_PREFIX}${absId}`;
};

export const buildTmdbAnimeDetailHref = (
  tmdbId: number,
  mediaType: "tv" | "movie" = "tv",
): string => `/anime/${toTmdbAnimeRouteSlug(tmdbId, mediaType)}`;
