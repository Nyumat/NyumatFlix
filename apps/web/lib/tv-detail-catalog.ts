import {
  isAnimeAnilistRouteId,
  isAnilistTvRouteId,
} from "@/lib/anilist-route-id";
import { isMalAnimeRouteId } from "@/lib/mal/route-id";

export type TvDetailCatalog = "anime" | "tvshows";

export const TV_DETAIL_CATALOG_QUERY = "catalog";
export const TV_DETAIL_CATALOG_ANIME = "anime" as const;

export const resolveTvDetailCatalogFromPathname = (
  pathname: string,
): TvDetailCatalog => (pathname.startsWith("/anime/") ? "anime" : "tvshows");

export const readTvDetailCatalogFromRequestUrl = (
  url: URL,
): TvDetailCatalog | null => {
  const catalog = url.searchParams.get(TV_DETAIL_CATALOG_QUERY);
  if (catalog === TV_DETAIL_CATALOG_ANIME) {
    return "anime";
  }
  if (catalog === "tvshows") {
    return "tvshows";
  }
  return null;
};

/** True when `routeId` should use the AniList catalog resolver (not raw TMDB). */
export const isAnilistBackedTvRouteId = (
  routeId: string,
  catalog: TvDetailCatalog | null,
): boolean => {
  if (isMalAnimeRouteId(routeId)) {
    return false;
  }

  if (isAnilistTvRouteId(routeId)) {
    return true;
  }

  return catalog === "anime" && isAnimeAnilistRouteId(routeId);
};

export const withTvDetailCatalogQuery = (
  path: string,
  catalog: TvDetailCatalog | null,
): string => {
  if (catalog !== "anime") {
    return path;
  }

  const [pathname, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  if (!params.has(TV_DETAIL_CATALOG_QUERY)) {
    params.set(TV_DETAIL_CATALOG_QUERY, TV_DETAIL_CATALOG_ANIME);
  }
  const merged = params.toString();
  return merged ? `${pathname}?${merged}` : path;
};
