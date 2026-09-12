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
 * Keyless Kitsu catalog provider (JSON:API, no API key).
 *
 * Used as a fallback when AniList GraphQL is unstable. Kitsu has no rate
 * limits, exposes `anilist/anime` + `myanimelist/anime` mappings (for
 * rehydrating canonical `anilist-{id}` routes) and stable poster/cover
 * assets on `media.kitsu.app` (already allowlisted in next.config.mjs).
 *
 * Docs: https://kitsu.docs.apiary.io (filters/sorts verified live).
 */

export const KITSU_API_BASE = "https://kitsu.io/api/edge";
const KITSU_FETCH_TIMEOUT_MS = 8_000;

export type KitsuAnimeAttributes = {
  canonicalTitle?: string | null;
  titles?: {
    en?: string | null;
    en_jp?: string | null;
    ja_jp?: string | null;
  } | null;
  synopsis?: string | null;
  description?: string | null;
  startDate?: string | null;
  subtype?: string | null;
  status?: string | null;
  episodeCount?: number | null;
  episodeLength?: number | null;
  youtubeVideoId?: string | null;
  averageRating?: string | null;
  popularityRank?: number | null;
  ratingRank?: number | null;
  userCount?: number | null;
  favoritesCount?: number | null;
  nsfw?: boolean | null;
  ageRating?: string | null;
  posterImage?: {
    tiny?: string | null;
    small?: string | null;
    medium?: string | null;
    large?: string | null;
    original?: string | null;
  } | null;
  coverImage?: {
    tiny?: string | null;
    small?: string | null;
    large?: string | null;
    original?: string | null;
  } | null;
};

export type KitsuAnimeResource = {
  id: string;
  type: "anime";
  attributes?: KitsuAnimeAttributes | null;
};

export type KitsuMappingResource = {
  id: string;
  attributes?: {
    externalSite?: string | null;
    externalId?: string | null;
  } | null;
  relationships?: {
    item?: {
      data?: { type?: string | null; id?: string | null } | null;
    } | null;
  } | null;
};

export type KitsuAnimePageResult = {
  items: KitsuAnimeResource[];
  /** Kitsu id -> AniList id (only where `anilist/anime` mappings exist). */
  anilistIdsByKitsuId: Map<number, number>;
  /** Kitsu id -> MAL id (only where `myanimelist/anime` mappings exist). */
  malIdsByKitsuId: Map<number, number>;
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
};

type KitsuListResponse = {
  data?: KitsuAnimeResource[];
  included?: Array<
    | ({
        type?: "genres" | "mappings";
      } & KitsuMappingResource & {
          attributes?: { name?: string | null } & NonNullable<
            KitsuMappingResource["attributes"]
          >;
        })
    | { type?: string }
  >;
  meta?: { count?: number | null };
};

const KITSU_ANIME_FIELDS = [
  "canonicalTitle",
  "titles",
  "synopsis",
  "description",
  "startDate",
  "subtype",
  "status",
  "episodeCount",
  "episodeLength",
  "youtubeVideoId",
  "averageRating",
  "popularityRank",
  "ratingRank",
  "userCount",
  "favoritesCount",
  "nsfw",
  "ageRating",
  "posterImage",
  "coverImage",
].join(",");

const isAnilistMapping = (externalSite?: string | null) =>
  externalSite?.trim().toLowerCase() === "anilist/anime";

const isMalMapping = (externalSite?: string | null) =>
  externalSite?.trim().toLowerCase() === "myanimelist/anime";

const parseExternalId = (externalId?: string | null): number | null => {
  const parsed = Number.parseInt(externalId ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const parseKitsuId = (id: string): number | null => {
  const parsed = Number.parseInt(id, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const kitsuFetchEffect = (path: string) =>
  fetchResponseEffect({
    provider: "kitsu",
    input: `${KITSU_API_BASE}${path}`,
    timeoutMs: KITSU_FETCH_TIMEOUT_MS,
    init: {
      headers: { Accept: "application/vnd.api+json" },
      cache: "no-store",
    },
  });

const emptyKitsuPage = (
  page: number,
  perPage: number,
): KitsuAnimePageResult => ({
  items: [],
  anilistIdsByKitsuId: new Map(),
  malIdsByKitsuId: new Map(),
  page,
  perPage,
  total: 0,
  totalPages: page,
  hasNextPage: false,
});

/**
 * Verified-live Kitsu sort fields: -userCount, -favoritesCount, -averageRating,
 * -startDate. There is no trending/tba sort; those fall back to popularity.
 */
const KITSU_SORT_BY_ANILIST_SORT: Record<string, string> = {
  POPULARITY_DESC: "-userCount",
  TRENDING_DESC: "-userCount",
  SCORE_DESC: "-averageRating",
  FAVOURITES_DESC: "-favoritesCount",
  START_DATE_DESC: "-startDate",
};

/**
 * Verified-live Kitsu status values: current, finished, upcoming, tba, unreleased.
 */
const KITSU_STATUS_BY_ANILIST_STATUS: Record<string, string> = {
  RELEASING: "current",
  FINISHED: "finished",
  NOT_YET_RELEASED: "upcoming,tba",
  CANCELLED: "unreleased",
};

/** Verified-live Kitsu subtype values: TV, movie, OVA, ONA, special, music. */
const KITSU_SUBTYPE_BY_ANILIST_FORMAT: Record<string, string> = {
  TV: "TV",
  MOVIE: "movie",
  OVA: "OVA",
  ONA: "ONA",
  SPECIAL: "special",
  MUSIC: "music",
};

export const kitsuSortForAnilistSort = (sort?: string): string =>
  (sort && KITSU_SORT_BY_ANILIST_SORT[sort]) ?? "-userCount";

export const kitsuStatusForAnilistStatus = (status?: string): string | null =>
  (status && KITSU_STATUS_BY_ANILIST_STATUS[status]) ?? null;

export const kitsuSubtypeForAnilistFormat = (format?: string): string | null =>
  (format && KITSU_SUBTYPE_BY_ANILIST_FORMAT[format.toUpperCase()]) ?? null;

export type KitsuCatalogQuery = {
  page?: number;
  perPage?: number;
  search?: string;
  sort?: string;
  status?: string;
  format?: string;
  /** Kitsu category slugs (lowercase); unknown slugs return count 0, so pass through only. */
  categories?: string[];
  season?: string;
  seasonYear?: number;
};

export const buildKitsuAnimePath = ({
  page = 1,
  perPage = 24,
  search,
  sort = "-userCount",
  status,
  format,
  categories = [],
  season,
  seasonYear,
  includeMappings = true,
}: KitsuCatalogQuery & { includeMappings?: boolean }): string => {
  const params = new URLSearchParams();
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const safePerPage = Number.isInteger(perPage)
    ? Math.min(Math.max(perPage, 1), 20)
    : 20;
  params.set("page[limit]", String(safePerPage));
  params.set("page[offset]", String((safePage - 1) * safePerPage));
  params.set("fields[anime]", KITSU_ANIME_FIELDS);
  if (search?.trim()) params.set("filter[text]", search.trim());
  if (sort) params.set("sort", sort);
  if (status) params.set("filter[status]", status);
  if (format) params.set("filter[subtype]", format);
  for (const category of categories) {
    const slug = category.trim().toLowerCase();
    if (slug) params.append("filter[categories]", slug);
  }
  // `filter[season]` alone is a 6589-title soup; only send it with a year.
  if (season && Number.isInteger(seasonYear)) {
    params.set("filter[season]", season.trim().toLowerCase());
    params.set("filter[seasonYear]", String(seasonYear));
  } else if (Number.isInteger(seasonYear)) {
    params.set("filter[seasonYear]", String(seasonYear));
  }
  if (includeMappings) {
    params.set("include", "mappings");
    params.set("fields[mappings]", "externalSite,externalId");
  }
  return `/anime?${params.toString()}`;
};

export const readKitsuAnimePageEffect = (
  path: string,
  { page = 1, perPage = 24 }: { page?: number; perPage?: number } = {},
): Effect.Effect<KitsuAnimePageResult, CatalogProviderError> =>
  Effect.gen(function* () {
    const response = yield* kitsuFetchEffect(path);
    yield* requireOkResponse("kitsu", response);
    const payload = yield* readJsonEffect<KitsuListResponse>("kitsu", response);

    const items = Array.isArray(payload.data) ? payload.data : [];
    const total = payload.meta?.count ?? items.length;
    const safePage = Number.isInteger(page) && page > 0 ? page : 1;
    const safePerPage = Number.isInteger(perPage) && perPage > 0 ? perPage : 24;

    const anilistIdsByKitsuId = new Map<number, number>();
    const malIdsByKitsuId = new Map<number, number>();
    for (const entry of payload.included ?? []) {
      if (entry?.type !== "mappings") continue;
      const mapping = entry as KitsuMappingResource;
      const itemId =
        mapping.relationships?.item?.data?.type === "anime"
          ? parseKitsuId(mapping.relationships.item.data.id ?? "")
          : null;
      const externalId = parseExternalId(mapping.attributes?.externalId);
      if (!itemId || !externalId) continue;
      if (isAnilistMapping(mapping.attributes?.externalSite)) {
        if (!anilistIdsByKitsuId.has(itemId)) {
          anilistIdsByKitsuId.set(itemId, externalId);
        }
      } else if (isMalMapping(mapping.attributes?.externalSite)) {
        if (!malIdsByKitsuId.has(itemId)) {
          malIdsByKitsuId.set(itemId, externalId);
        }
      }
    }

    // Without include=mappings, resolve via relationships on follow-up calls.
    return {
      items,
      anilistIdsByKitsuId,
      malIdsByKitsuId,
      page: safePage,
      perPage: safePerPage,
      total,
      totalPages: Math.max(safePage, Math.ceil(total / safePerPage) || 1),
      hasNextPage: safePage * safePerPage < total,
    };
  });

export const readKitsuAnimePage = (
  path: string,
  options: { page?: number; perPage?: number } = {},
): Promise<KitsuAnimePageResult | null> =>
  runCatalogEffect(readKitsuAnimePageEffect(path, options)).catch(() => null);

export const fetchKitsuAnimePage = async (
  query: KitsuCatalogQuery,
): Promise<KitsuAnimePageResult | null> =>
  runCatalogEffect(fetchKitsuAnimePageEffect(query)).catch(() => null);

export const fetchKitsuAnimePageEffect = (
  query: KitsuCatalogQuery,
): Effect.Effect<KitsuAnimePageResult | null, CatalogProviderError> =>
  Effect.gen(function* () {
    const page = query.page ?? 1;
    // Kitsu caps page[limit] at 20; pagination math must use the actual limit.
    const requestedPerPage = query.perPage ?? 24;
    const limit = Math.min(requestedPerPage, 20);
    const path = buildKitsuAnimePath({ ...query, page, perPage: limit });
    const result = yield* readKitsuAnimePageEffect(path, {
      page,
      perPage: limit,
    });
    if (!result) return null;
    if (result.items.length === 0)
      return emptyKitsuPage(page, requestedPerPage);
    return { ...result, perPage: requestedPerPage };
  });

export const fetchKitsuMappingsByExternalId = async ({
  site,
  externalId,
}: {
  site: "anilist/anime" | "myanimelist/anime";
  externalId: number;
}): Promise<{
  kitsuId: number;
  anilistId: number | null;
  malId: number | null;
} | null> => {
  const params = new URLSearchParams({
    "filter[externalSite]": site,
    "filter[externalId]": String(externalId),
    include: "item",
    "fields[anime]": "canonicalTitle",
    "page[limit]": "5",
  });
  const effect = Effect.gen(function* () {
    const response = yield* kitsuFetchEffect(`/mappings?${params.toString()}`);
    yield* requireOkResponse("kitsu", response);
    const payload = yield* readJsonEffect<{
      data?: KitsuMappingResource[];
      included?: Array<{ type?: string; id?: string }>;
    }>("kitsu", response);

    for (const entry of payload.data ?? []) {
      const kitsuId =
        entry.relationships?.item?.data?.type === "anime"
          ? parseKitsuId(entry.relationships.item.data.id ?? "")
          : null;
      if (!kitsuId) continue;
      return {
        kitsuId,
        anilistId: site === "anilist/anime" ? externalId : null,
        malId: site === "myanimelist/anime" ? externalId : null,
      };
    }
    return null;
  });

  return runCatalogEffect(effect).catch(() => null);
};
