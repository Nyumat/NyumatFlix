/** MAL-backed anime routes use `mal-{id}` under `/anime/`. */

export const MAL_ANIME_ROUTE_PREFIX = "mal-";

export const toMalAnimeRouteSlug = (malId: number): string =>
  `${MAL_ANIME_ROUTE_PREFIX}${Math.abs(malId)}`;

export const isMalAnimeRouteId = (routeId: string): boolean =>
  routeId.startsWith(MAL_ANIME_ROUTE_PREFIX) &&
  Number.isInteger(
    Number.parseInt(routeId.slice(MAL_ANIME_ROUTE_PREFIX.length), 10),
  );

export const fromMalAnimeRouteId = (routeId: string): number =>
  Number.parseInt(routeId.slice(MAL_ANIME_ROUTE_PREFIX.length), 10);

export const buildMalAnimeDetailHref = (malId: number): string =>
  `/anime/${toMalAnimeRouteSlug(malId)}`;
