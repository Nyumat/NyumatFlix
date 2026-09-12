import "server-only";

import {
  fetchResponseEffect,
  readJsonEffect,
  requireOkResponse,
  runCatalogEffect,
  type CatalogProviderError,
} from "@/lib/server/catalog-effect";
import { Effect } from "effect";

/**
 * Keyless Jikan catalog provider (MAL-backed REST, no API key).
 *
 * Last-resort fallback when AniList, Kitsu, and TMDB all fail. Jikan scrapes
 * MAL, so it is down whenever MAL is down (verified: 504s during research),
 * and enforces 3 req/s + 60 req/min per IP — hence the local gate below.
 * Per-item `?sfw=true` keeps gray/black NSFW entries out of fallback grids.
 *
 * Docs: https://docs.api.jikan.moe
 */

export const JIKAN_API_BASE = "https://api.jikan.moe/v4";
const JIKAN_FETCH_TIMEOUT_MS = 10_000;
const JIKAN_MIN_INTERVAL_MS = 400;
const JIKAN_MAX_PER_PAGE = 25;

let jikanGateUntilMs = 0;

export const resetJikanGateForTests = () => {
  jikanGateUntilMs = 0;
};

const waitForJikanGate = async (now: () => number = Date.now) => {
  const remaining = jikanGateUntilMs - now();
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }
  jikanGateUntilMs = Math.max(jikanGateUntilMs, now()) + JIKAN_MIN_INTERVAL_MS;
};

export type JikanAnimeItem = {
  mal_id?: number | null;
  url?: string | null;
  title?: string | null;
  title_english?: string | null;
  title_japanese?: string | null;
  type?: string | null;
  status?: string | null;
  airing?: boolean | null;
  synopsis?: string | null;
  season?: string | null;
  year?: number | null;
  episodes?: number | null;
  duration?: string | null;
  score?: number | null;
  scored_by?: number | null;
  popularity?: number | null;
  favorites?: number | null;
  rank?: number | null;
  rating?: string | null;
  images?: {
    jpg?: {
      image_url?: string | null;
      small_image_url?: string | null;
      large_image_url?: string | null;
    } | null;
    webp?: {
      image_url?: string | null;
      small_image_url?: string | null;
      large_image_url?: string | null;
    } | null;
  } | null;
  trailer?: { youtube_id?: string | null } | null;
  aired?: {
    from?: string | null;
    to?: string | null;
  } | null;
  genres?: Array<{ mal_id?: number | null; name?: string | null }> | null;
  explicit_genres?: Array<{
    mal_id?: number | null;
    name?: string | null;
  }> | null;
  themes?: Array<{ mal_id?: number | null; name?: string | null }> | null;
};

export type JikanAnimePageResult = {
  items: JikanAnimeItem[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
};

type JikanListResponse = {
  data?: JikanAnimeItem[];
  pagination?: {
    last_visible_page?: number | null;
    has_next_page?: boolean | null;
    current_page?: number | null;
    items?: {
      count?: number | null;
      total?: number | null;
      per_page?: number | null;
    } | null;
  };
};

const jikanFetchEffect = (path: string) =>
  fetchResponseEffect({
    provider: "jikan",
    input: `${JIKAN_API_BASE}${path}`,
    timeoutMs: JIKAN_FETCH_TIMEOUT_MS,
    init: {
      headers: { Accept: "application/json" },
      cache: "no-store",
    },
  });

export const emptyJikanPage = (
  page: number,
  perPage: number,
): JikanAnimePageResult => ({
  items: [],
  page,
  perPage,
  total: 0,
  totalPages: page,
  hasNextPage: false,
});

export type JikanCatalogQuery = {
  page?: number;
  perPage?: number;
  search?: string;
  /** top | season | schedule supported; defaults to top airing fallback. */
  orderBy?: "members" | "score" | "start_date" | "favorites";
  sort?: "desc" | "asc";
  status?: "airing" | "complete" | "upcoming";
  type?: "tv" | "movie" | "ova" | "special" | "ona" | "music";
};

export const buildJikanAnimePath = ({
  page = 1,
  perPage = 24,
  search,
  orderBy = "members",
  sort = "desc",
  status,
  type,
}: JikanCatalogQuery): string => {
  const params = new URLSearchParams();
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const safeLimit = Number.isInteger(perPage)
    ? Math.min(Math.max(perPage, 1), JIKAN_MAX_PER_PAGE)
    : JIKAN_MAX_PER_PAGE;
  params.set("page", String(safePage));
  params.set("limit", String(safeLimit));
  params.set("sfw", "true");
  if (search?.trim()) params.set("q", search.trim());
  params.set("order_by", orderBy);
  params.set("sort", sort);
  if (status) params.set("status", status);
  if (type) params.set("type", type);
  return `/anime?${params.toString()}`;
};

export const buildJikanTopAnimePath = ({
  page = 1,
  perPage = 24,
  type,
  filter,
}: {
  page?: number;
  perPage?: number;
  type?: "tv" | "movie" | "ova" | "special" | "ona" | "music";
  filter?: "airing" | "upcoming" | "bypopularity" | "favorite";
} = {}): string => {
  const params = new URLSearchParams();
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const safeLimit = Number.isInteger(perPage)
    ? Math.min(Math.max(perPage, 1), JIKAN_MAX_PER_PAGE)
    : JIKAN_MAX_PER_PAGE;
  params.set("page", String(safePage));
  params.set("limit", String(safeLimit));
  params.set("sfw", "true");
  if (type) params.set("type", type);
  if (filter) params.set("filter", filter);
  return `/top/anime?${params.toString()}`;
};

export const readJikanAnimePageEffect = (
  path: string,
  { page = 1, perPage = 24 }: { page?: number; perPage?: number } = {},
): Effect.Effect<JikanAnimePageResult, CatalogProviderError> =>
  Effect.gen(function* () {
    yield* Effect.promise(() => waitForJikanGate());
    const response = yield* jikanFetchEffect(path);
    yield* requireOkResponse("jikan", response);
    const payload = yield* readJsonEffect<JikanListResponse>("jikan", response);

    const items = Array.isArray(payload.data) ? payload.data : [];
    const safePage = Number.isInteger(page) && page > 0 ? page : 1;
    const pagination = payload.pagination;
    const total = pagination?.items?.total ?? items.length;
    const totalPages = pagination?.last_visible_page ?? safePage;
    const hasNextPage = pagination?.has_next_page ?? false;

    return {
      items,
      page: pagination?.current_page ?? safePage,
      perPage,
      total,
      totalPages: Math.max(safePage, totalPages),
      hasNextPage,
    };
  });

export const readJikanAnimePage = (
  path: string,
  options: { page?: number; perPage?: number } = {},
): Promise<JikanAnimePageResult | null> =>
  runCatalogEffect(readJikanAnimePageEffect(path, options)).catch(() => null);

export const fetchJikanAnimePage = async (
  query: JikanCatalogQuery,
): Promise<JikanAnimePageResult | null> =>
  runCatalogEffect(fetchJikanAnimePageEffect(query)).catch(() => null);

export const fetchJikanAnimePageEffect = (
  query: JikanCatalogQuery,
): Effect.Effect<JikanAnimePageResult, CatalogProviderError> =>
  readJikanAnimePageEffect(buildJikanAnimePath(query), {
    page: query.page ?? 1,
    perPage: query.perPage ?? 24,
  });

export const fetchJikanTopAnimePage = async (options?: {
  page?: number;
  perPage?: number;
  type?: JikanCatalogQuery["type"];
  filter?: "airing" | "upcoming" | "bypopularity" | "favorite";
}): Promise<JikanAnimePageResult | null> =>
  runCatalogEffect(fetchJikanTopAnimePageEffect(options)).catch(() => null);

export const fetchJikanTopAnimePageEffect = (options?: {
  page?: number;
  perPage?: number;
  type?: JikanCatalogQuery["type"];
  filter?: "airing" | "upcoming" | "bypopularity" | "favorite";
}): Effect.Effect<JikanAnimePageResult, CatalogProviderError> =>
  readJikanAnimePageEffect(buildJikanTopAnimePath(options), {
    page: options?.page ?? 1,
    perPage: options?.perPage ?? 24,
  });

export const fetchJikanAnimeByMalId = async (
  malId: number,
): Promise<JikanAnimeItem | null> => {
  if (!Number.isInteger(malId) || malId <= 0) return null;
  const effect = Effect.gen(function* () {
    yield* Effect.promise(() => waitForJikanGate());
    const response = yield* jikanFetchEffect(`/anime/${malId}?sfw=true`);
    yield* requireOkResponse("jikan", response);
    const payload = yield* readJsonEffect<{ data?: JikanAnimeItem }>(
      "jikan",
      response,
    );
    return payload.data ?? null;
  });

  return runCatalogEffect(effect).catch(() => null);
};
