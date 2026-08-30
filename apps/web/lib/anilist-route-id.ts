/** AniList-backed anime catalog routes use `anilist-{id}` slugs under `/anime/`. */

import { isMalAnimeRouteId } from "@/lib/mal/route-id";
import { isTmdbAnimeRouteId } from "@/lib/tmdb-anime-route-id";

export const ANILIST_TV_ROUTE_PREFIX = "anilist-";

const BARE_ANILIST_ROUTE_ID = /^\d+$/;

export const toAnilistTvRouteSlug = (anilistId: number): string =>
  `${ANILIST_TV_ROUTE_PREFIX}${Math.abs(anilistId)}`;

export const isBareAnilistRouteId = (routeId: string): boolean =>
  BARE_ANILIST_ROUTE_ID.test(routeId) && Number.parseInt(routeId, 10) > 0;

/** Route ids for `/anime/[id]` detail pages (prefixed slug, legacy bare numeric, or negative). */
export const isAnimeAnilistRouteId = (routeId: string): boolean => {
  if (isMalAnimeRouteId(routeId) || isTmdbAnimeRouteId(routeId)) {
    return false;
  }

  return isAnilistTvRouteId(routeId) || isBareAnilistRouteId(routeId);
};

export const parseAnimeAnilistRouteId = (routeId: string): number | null => {
  if (!isAnimeAnilistRouteId(routeId)) {
    return null;
  }

  return fromAnilistTvRouteId(routeId);
};

export const isAnilistTvRouteId = (routeId: string | number): boolean => {
  if (typeof routeId === "string") {
    return (
      routeId.startsWith(ANILIST_TV_ROUTE_PREFIX) ||
      (routeId.startsWith("-") &&
        Number.parseInt(routeId, 10) < 0 &&
        Number.isInteger(Number.parseInt(routeId, 10)))
    );
  }

  return Number.isInteger(routeId) && routeId < 0;
};

export const fromAnilistTvRouteId = (routeId: string | number): number => {
  if (typeof routeId === "string") {
    if (routeId.startsWith(ANILIST_TV_ROUTE_PREFIX)) {
      return Number.parseInt(routeId.slice(ANILIST_TV_ROUTE_PREFIX.length), 10);
    }

    if (isBareAnilistRouteId(routeId)) {
      return Number.parseInt(routeId, 10);
    }

    return Math.abs(Number.parseInt(routeId, 10));
  }

  return Math.abs(routeId);
};

export const normalizeAnilistTvRouteSlug = (routeId: string): string => {
  if (routeId.startsWith(ANILIST_TV_ROUTE_PREFIX)) {
    return routeId;
  }

  if (isBareAnilistRouteId(routeId)) {
    return toAnilistTvRouteSlug(Number.parseInt(routeId, 10));
  }

  if (routeId.startsWith("-")) {
    return toAnilistTvRouteSlug(fromAnilistTvRouteId(routeId));
  }

  return routeId;
};

export const buildAnilistTvDetailHref = (
  anilistId: number,
  options?: { season?: number },
): string => {
  const params = new URLSearchParams();
  if (options?.season && options.season > 0) {
    params.set("season", String(options.season));
  }
  const query = params.toString();
  const path = `/anime/${toAnilistTvRouteSlug(anilistId)}`;
  return query ? `${path}?${query}` : path;
};

/** Upgrade legacy `/anime/{id}` links to prefixed AniList slugs. */
export const normalizeAnilistAnimeDetailHref = (href: string): string => {
  const trimmed = href.trim();
  const match = trimmed.match(/^\/anime\/(\d+)(.*)$/);
  if (!match?.[1] || !isBareAnilistRouteId(match[1])) {
    return trimmed;
  }

  const anilistId = Number.parseInt(match[1], 10);
  const suffix = match[2] ?? "";
  return `${buildAnilistTvDetailHref(anilistId)}${suffix}`;
};

/** Route slug for detail APIs/navigation: AniList slugs from the path, else TMDB id. */
export const resolveTvDetailRouteId = (
  pathname: string,
  fallbackContentId: number | string,
): string => {
  const match = pathname.match(/\/(?:tvshows|anime)\/([^/?#]+)/);
  const routeSegment = match?.[1];
  if (
    routeSegment &&
    (isMalAnimeRouteId(routeSegment) || isTmdbAnimeRouteId(routeSegment))
  ) {
    return routeSegment;
  }
  if (routeSegment && pathname.startsWith("/anime/")) {
    if (isAnimeAnilistRouteId(routeSegment)) {
      return normalizeAnilistTvRouteSlug(routeSegment);
    }
  } else if (routeSegment && isAnilistTvRouteId(routeSegment)) {
    return routeSegment;
  }

  return String(fallbackContentId);
};

export const resolveAnilistIdFromTvRoute = (
  routeId: string,
  explicitAnilistId?: number | null,
): number | null => {
  if (isAnilistTvRouteId(routeId)) {
    return fromAnilistTvRouteId(routeId);
  }

  if (
    typeof explicitAnilistId === "number" &&
    Number.isInteger(explicitAnilistId)
  ) {
    return explicitAnilistId;
  }

  return null;
};
