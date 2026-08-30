import {
  fromAnilistTvRouteId,
  isAnimeAnilistRouteId,
  isAnilistTvRouteId,
  normalizeAnilistTvRouteSlug,
  parseAnimeAnilistRouteId,
  resolveTvDetailRouteId,
  toAnilistTvRouteSlug,
} from "@/lib/anilist-route-id";
import { isMalAnimeRouteId } from "@/lib/mal/route-id";
import {
  isTmdbAnimeRouteId,
  parseTmdbAnimeRouteId,
} from "@/lib/tmdb-anime-route-id";

export type TvDetailCatalog = "anime" | "tvshows";

export const TV_DETAIL_CATALOG_QUERY = "catalog";
export const TV_DETAIL_CATALOG_ANIME = "anime" as const;

export const resolveTvDetailCatalogFromPathname = (
  pathname: string,
): TvDetailCatalog => (pathname.startsWith("/anime/") ? "anime" : "tvshows");

export const resolveTvDetailCatalogFromHref = (
  href: string,
): TvDetailCatalog | null => {
  if (href.startsWith("/anime/")) {
    return "anime";
  }
  if (href.startsWith("/tvshows/")) {
    return "tvshows";
  }
  return null;
};

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

/** Prefix AniList ids in `/api/media/tv` paths so they cannot collide with TMDB ids. */
export const toTvApiRouteId = (
  routeId: string,
  catalog: TvDetailCatalog | null,
): string => {
  if (isMalAnimeRouteId(routeId) || isTmdbAnimeRouteId(routeId)) {
    return routeId;
  }

  if (isAnilistTvRouteId(routeId)) {
    return normalizeAnilistTvRouteSlug(routeId);
  }

  if (catalog === "anime" && isAnimeAnilistRouteId(routeId)) {
    return toAnilistTvRouteSlug(fromAnilistTvRouteId(routeId));
  }

  return routeId;
};

/** Bare AniList id for `/api/anime/{id}` — never a TMDB id. */
export const toAnimeApiId = (routeId: string): string | null => {
  const anilistId = parseAnimeAnilistRouteId(routeId);
  return anilistId ? String(anilistId) : null;
};

export const resolveAnimePrefetchRouteId = (href: string): string | null => {
  const match = href.match(/^\/anime\/([^/?#]+)/);
  if (!match?.[1]) {
    return null;
  }

  return toTvApiRouteId(decodeURIComponent(match[1]), "anime");
};

const rewriteAnimeCatalogTvApiPath = (
  pathname: string,
  querySuffix: string,
): string | null => {
  const tvMatch = pathname.match(/^\/api\/tv\/([^/]+)(\/.*)?$/);
  if (!tvMatch?.[1]) {
    return null;
  }

  const routeId = decodeURIComponent(tvMatch[1]);
  const rest = tvMatch[2] ?? "";
  const animeId = toAnimeApiId(routeId);
  if (animeId) {
    return `/api/anime/${animeId}${rest}${querySuffix}`;
  }

  const tmdb = parseTmdbAnimeRouteId(routeId);
  if (tmdb) {
    return `/api/tv/${tmdb.tmdbId}${rest}${querySuffix}`;
  }

  return null;
};

export const withTvApiRouteId = (
  path: string,
  catalog: TvDetailCatalog | null,
): string => {
  const [pathname, query = ""] = path.split("?");
  const querySuffix = query ? `?${query}` : "";

  if (catalog === "anime") {
    const animePath = rewriteAnimeCatalogTvApiPath(pathname, querySuffix);
    if (animePath) {
      return animePath;
    }
  }

  const rewritten = pathname.replace(
    /^(\/api\/media\/tv\/)([^/]+)/,
    (_full, prefix: string, routeId: string) =>
      `${prefix}${toTvApiRouteId(decodeURIComponent(routeId), catalog)}`,
  );
  const withQuery = query ? `${rewritten}?${query}` : rewritten;
  return withTvDetailCatalogQuery(withQuery, catalog);
};

/** Use the page URL's namespace so AniList and TMDB ids never share `/api/tv`. */
export const withPageTvApiPath = (
  path: string,
  pagePathname: string | null | undefined,
): string => {
  const catalog = pagePathname
    ? resolveTvDetailCatalogFromPathname(pagePathname)
    : null;
  const tvCatalog = catalog === "anime" ? "anime" : null;
  const [apiPathname, query = ""] = path.split("?");
  const tvMatch = apiPathname.match(/^\/api\/tv\/([^/]+)(\/.*)?$/);
  if (!tvMatch?.[1] || !pagePathname) {
    return withTvApiRouteId(path, tvCatalog);
  }

  const routeId = resolveTvDetailRouteId(
    pagePathname,
    decodeURIComponent(tvMatch[1]),
  );
  const rest = tvMatch[2] ?? "";
  const rebuilt = `/api/tv/${routeId}${rest}${query ? `?${query}` : ""}`;
  return withTvApiRouteId(rebuilt, tvCatalog);
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
