/** AniList-backed TV routes use `anilist-{id}` under `/tvshows/`. */

export const ANILIST_TV_ROUTE_PREFIX = "anilist-";

export const toAnilistTvRouteSlug = (anilistId: number): string =>
  `${ANILIST_TV_ROUTE_PREFIX}${Math.abs(anilistId)}`;

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

    return Math.abs(Number.parseInt(routeId, 10));
  }

  return Math.abs(routeId);
};

export const normalizeAnilistTvRouteSlug = (routeId: string): string => {
  if (routeId.startsWith(ANILIST_TV_ROUTE_PREFIX)) {
    return routeId;
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
  const slug = toAnilistTvRouteSlug(anilistId);
  const params = new URLSearchParams();
  if (options?.season && options.season > 0) {
    params.set("season", String(options.season));
  }
  const query = params.toString();
  return query ? `/tvshows/${slug}?${query}` : `/tvshows/${slug}`;
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
