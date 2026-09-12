import "server-only";

import {
  fetchKitsuAnimePageEffect,
  kitsuSortForAnilistSort,
  kitsuStatusForAnilistStatus,
  kitsuSubtypeForAnilistFormat,
  type KitsuAnimePageResult,
  type KitsuAnimeResource,
} from "@/lib/kitsu/client";
import {
  runCatalogEffect,
  type CatalogProviderError,
} from "@/lib/server/catalog-effect";
import { Effect } from "effect";
import type {
  AniListMedia,
  AniListPage,
  AniListSearchParams,
} from "@/lib/anilist-shared";

export const KITSU_FALLBACK_ID_BASE = -2_000_000_000;
export const KITSU_FALLBACK_ID_RANGE = 100_000_000;

const kitsuIdToFallbackId = (kitsuId: number): number =>
  KITSU_FALLBACK_ID_BASE - kitsuId;

export const kitsuFallbackIdToKitsuId = (fallbackId: number): number | null => {
  if (!Number.isInteger(fallbackId) || fallbackId > KITSU_FALLBACK_ID_BASE) {
    return null;
  }
  const kitsuId = KITSU_FALLBACK_ID_BASE - fallbackId;
  if (
    !Number.isInteger(kitsuId) ||
    kitsuId <= 0 ||
    kitsuId >= KITSU_FALLBACK_ID_RANGE
  ) {
    return null;
  }
  return kitsuId;
};

export const isKitsuFallbackId = (id: number): boolean =>
  kitsuFallbackIdToKitsuId(id) !== null;

const KITSU_TO_ANILIST_GENRES = new Set([
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Fantasy",
  "Horror",
  "Mecha",
  "Music",
  "Mystery",
  "Psychological",
  "Romance",
  "Sci-Fi",
  "Slice of Life",
  "Sports",
  "Supernatural",
  "Thriller",
]);

/** Kitsu genre names with no exact AniList equivalent are dropped. */
const normalizeKitsuGenre = (genre: string): string | null => {
  const trimmed = genre.trim();
  if (!trimmed) return null;
  if (KITSU_TO_ANILIST_GENRES.has(trimmed)) return trimmed;
  const lower = trimmed.toLowerCase();
  if (lower === "school life" || lower === "school") return "Slice of Life";
  return null;
};

const kitsuStatusToAnilist = (status?: string | null): string | null => {
  switch (status) {
    case "current":
      return "RELEASING";
    case "finished":
      return "FINISHED";
    case "upcoming":
    case "tba":
      return "NOT_YET_RELEASED";
    case "unreleased":
      return "CANCELLED";
    default:
      return null;
  }
};

const kitsuSubtypeToAnilistFormat = (
  subtype?: string | null,
): string | null => {
  switch (subtype?.toUpperCase()) {
    case "TV":
      return "TV";
    case "MOVIE":
      return "MOVIE";
    case "OVA":
      return "OVA";
    case "ONA":
      return "ONA";
    case "SPECIAL":
      return "SPECIAL";
    case "MUSIC":
      return "MUSIC";
    default:
      return null;
  }
};

export const kitsuResourceToAniListMedia = (
  item: KitsuAnimeResource,
  genres: readonly string[] = [],
  anilistId?: number | null,
  malId?: number | null,
): AniListMedia | null => {
  const kitsuId = Number.parseInt(item.id, 10);
  if (!Number.isInteger(kitsuId) || kitsuId <= 0) return null;

  const attributes = item.attributes ?? {};
  const title =
    attributes.titles?.en?.trim() ||
    attributes.canonicalTitle?.trim() ||
    attributes.titles?.en_jp?.trim() ||
    attributes.titles?.ja_jp?.trim() ||
    "";
  if (!title) return null;

  const startDate = attributes.startDate ?? "";
  const year = Number.parseInt(startDate.slice(0, 4), 10);
  const month = Number.parseInt(startDate.slice(5, 7), 10);
  const day = Number.parseInt(startDate.slice(8, 10), 10);
  const averageRating = Number.parseFloat(attributes.averageRating ?? "");
  const poster =
    attributes.posterImage?.large?.trim() ||
    attributes.posterImage?.medium?.trim() ||
    attributes.posterImage?.original?.trim() ||
    attributes.posterImage?.small?.trim() ||
    null;
  const banner =
    attributes.coverImage?.large?.trim() ||
    attributes.coverImage?.original?.trim() ||
    null;

  return {
    id:
      anilistId && Number.isInteger(anilistId) && anilistId > 0
        ? anilistId
        : kitsuIdToFallbackId(kitsuId),
    idMal: malId ?? null,
    title: {
      romaji: attributes.titles?.en_jp?.trim() || title,
      english: attributes.titles?.en?.trim() || title,
      native: attributes.titles?.ja_jp?.trim() || null,
    },
    type: "ANIME",
    format: kitsuSubtypeToAnilistFormat(attributes.subtype) ?? "TV",
    status: kitsuStatusToAnilist(attributes.status),
    description:
      attributes.synopsis?.trim() || attributes.description?.trim() || null,
    episodes:
      typeof attributes.episodeCount === "number" && attributes.episodeCount > 0
        ? attributes.episodeCount
        : null,
    coverImage: poster
      ? { large: poster, extraLarge: poster, color: null }
      : null,
    bannerImage: banner,
    genres: genres
      .map(normalizeKitsuGenre)
      .filter((genre): genre is string => genre !== null),
    averageScore: Number.isFinite(averageRating)
      ? Math.round(averageRating * 10) / 10
      : null,
    popularity: attributes.userCount ?? attributes.favoritesCount ?? null,
    trending: attributes.popularityRank ?? null,
    isAdult: attributes.nsfw === true || attributes.ageRating === "R18",
    startDate: Number.isInteger(year)
      ? {
          year,
          month: Number.isInteger(month) ? month : null,
          day: Number.isInteger(day) ? day : null,
        }
      : null,
    seasonYear: Number.isInteger(year) ? year : null,
    siteUrl: `https://kitsu.io/anime/${kitsuId}`,
  };
};

export const kitsuPageToAniListPage = (
  result: KitsuAnimePageResult,
  perPage: number,
): AniListPage => {
  const media: AniListMedia[] = [];
  for (const item of result.items) {
    const kitsuId = Number.parseInt(item.id, 10);
    const mapped = kitsuResourceToAniListMedia(
      item,
      [],
      Number.isInteger(kitsuId)
        ? (result.anilistIdsByKitsuId.get(kitsuId) ?? null)
        : null,
      Number.isInteger(kitsuId)
        ? (result.malIdsByKitsuId.get(kitsuId) ?? null)
        : null,
    );
    if (mapped) media.push(mapped);
  }

  return {
    pageInfo: {
      currentPage: result.page,
      lastPage: result.totalPages,
      hasNextPage: result.hasNextPage,
      total: result.total,
      perPage,
    },
    media,
  };
};

const kitsuCategoryForAnilistGenre = (genre: string): string | null => {
  const slug = genre
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  if (!slug) return null;
  // Verified live: unknown slugs return count 0 (safe pass-through), except
  // these two which need remapping.
  if (slug === "mahou-shoujo") return "fantasy";
  if (slug === "sci-fi") return "science-fiction";
  return slug;
};

export const fetchKitsuAnimeFallbackPage = async ({
  page = 1,
  perPage = 24,
  params,
  reason,
}: {
  page?: number;
  perPage?: number;
  params: AniListSearchParams;
  reason?: string;
}): Promise<AniListPage | null> =>
  runCatalogEffect(
    fetchKitsuAnimeFallbackPageEffect({ page, perPage, params, reason }),
  ).catch(() => null);

export const fetchKitsuAnimeFallbackPageEffect = ({
  page = 1,
  perPage = 24,
  params,
  reason,
}: {
  page?: number;
  perPage?: number;
  params: AniListSearchParams;
  reason?: string;
}): Effect.Effect<AniListPage | null, CatalogProviderError> =>
  Effect.gen(function* () {
    // Adult genre filtering stays AniList-only (Kitsu has no nsfw filter).
    if (params.genres.includes("Hentai")) {
      return null;
    }

    const result = yield* fetchKitsuAnimePageEffect({
      page,
      perPage,
      search: params.query,
      sort: kitsuSortForAnilistSort(params.sort),
      status: params.status
        ? (kitsuStatusForAnilistStatus(params.status) ?? undefined)
        : undefined,
      format: params.format
        ? (kitsuSubtypeForAnilistFormat(params.format) ?? undefined)
        : undefined,
      categories: params.genres
        .map(kitsuCategoryForAnilistGenre)
        .filter((slug): slug is string => slug !== null),
      season: params.season,
      seasonYear: params.year,
    });

    if (!result || result.items.length === 0) {
      yield* Effect.sync(() =>
        console.warn(
          `Kitsu anime fallback empty${reason ? ` (${reason})` : ""}; continuing to TMDB fallback.`,
        ),
      );
      return null;
    }

    return kitsuPageToAniListPage(result, perPage);
  });
