/** Kitsu-backed anime routes use `kitsu-{id}` under `/anime/`. */

export const KITSU_ANIME_ROUTE_PREFIX = "kitsu-";

export const toKitsuAnimeRouteSlug = (kitsuId: number): string =>
  `${KITSU_ANIME_ROUTE_PREFIX}${Math.abs(kitsuId)}`;

export const isKitsuAnimeRouteId = (routeId: string): boolean => {
  if (!routeId.startsWith(KITSU_ANIME_ROUTE_PREFIX)) return false;
  const parsed = Number.parseInt(
    routeId.slice(KITSU_ANIME_ROUTE_PREFIX.length),
    10,
  );
  return Number.isInteger(parsed) && parsed > 0;
};

export const fromKitsuAnimeRouteId = (routeId: string): number =>
  Number.parseInt(routeId.slice(KITSU_ANIME_ROUTE_PREFIX.length), 10);

export const buildKitsuAnimeDetailHref = (kitsuId: number): string =>
  `/anime/${toKitsuAnimeRouteSlug(kitsuId)}`;
