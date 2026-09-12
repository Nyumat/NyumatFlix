import "server-only";

import {
  fetchJikanAnimePageEffect,
  fetchJikanTopAnimePageEffect,
  type JikanAnimeItem,
} from "@/lib/jikan/client";
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

export const JIKAN_FALLBACK_ID_BASE = -2_100_000_000;
export const JIKAN_FALLBACK_ID_RANGE = 100_000_000;

const malIdToFallbackId = (malId: number): number =>
  JIKAN_FALLBACK_ID_BASE - malId;

export const jikanFallbackIdToMalId = (fallbackId: number): number | null => {
  if (!Number.isInteger(fallbackId) || fallbackId > JIKAN_FALLBACK_ID_BASE) {
    return null;
  }
  const malId = JIKAN_FALLBACK_ID_BASE - fallbackId;
  if (
    !Number.isInteger(malId) ||
    malId <= 0 ||
    malId >= JIKAN_FALLBACK_ID_RANGE
  ) {
    return null;
  }
  return malId;
};

export const isJikanFallbackId = (id: number): boolean =>
  jikanFallbackIdToMalId(id) !== null;

const JIKAN_TO_ANILIST_GENRES = new Set([
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

const normalizeJikanGenre = (name?: string | null): string | null => {
  const trimmed = name?.trim();
  if (!trimmed) return null;
  if (JIKAN_TO_ANILIST_GENRES.has(trimmed)) return trimmed;
  const lower = trimmed.toLowerCase();
  if (lower === "school") return "Slice of Life";
  return null;
};

const jikanTypeToAnilistFormat = (type?: string | null): string => {
  switch (type?.trim().toLowerCase()) {
    case "tv":
      return "TV";
    case "movie":
      return "MOVIE";
    case "ova":
      return "OVA";
    case "ona":
      return "ONA";
    case "special":
      return "SPECIAL";
    case "music":
      return "MUSIC";
    default:
      return "TV";
  }
};

const jikanStatusToAnilist = (
  status?: string | null,
  airing?: boolean | null,
): string | null => {
  const normalized = status?.trim().toLowerCase();
  if (normalized === "currently airing" || airing === true) return "RELEASING";
  if (normalized === "finished airing" || normalized === "complete")
    return "FINISHED";
  if (normalized === "not yet aired" || normalized === "upcoming")
    return "NOT_YET_RELEASED";
  return null;
};

export const jikanItemToAniListMedia = (
  item: JikanAnimeItem,
): AniListMedia | null => {
  const malId =
    typeof item.mal_id === "number" &&
    Number.isInteger(item.mal_id) &&
    item.mal_id > 0
      ? item.mal_id
      : null;
  if (!malId) return null;

  const title =
    item.title_english?.trim() ||
    item.title?.trim() ||
    item.title_japanese?.trim() ||
    "";
  if (!title) return null;

  const from = item.aired?.from ?? "";
  const year =
    (Number.isInteger(item.year) && (item.year as number) > 0
      ? (item.year as number)
      : Number.parseInt(from.slice(0, 4), 10)) || null;
  const month = Number.parseInt(from.slice(5, 7), 10);
  const day = Number.parseInt(from.slice(8, 10), 10);
  const poster =
    item.images?.webp?.large_image_url?.trim() ||
    item.images?.jpg?.large_image_url?.trim() ||
    item.images?.webp?.image_url?.trim() ||
    item.images?.jpg?.image_url?.trim() ||
    null;
  const format = jikanTypeToAnilistFormat(item.type);

  return {
    id: malIdToFallbackId(malId),
    idMal: malId,
    title: {
      romaji: item.title?.trim() || title,
      english: item.title_english?.trim() || title,
      native: item.title_japanese?.trim() || null,
    },
    type: "ANIME",
    format,
    status: jikanStatusToAnilist(item.status, item.airing),
    description: item.synopsis?.trim() || null,
    episodes:
      typeof item.episodes === "number" && item.episodes > 0
        ? item.episodes
        : null,
    coverImage: poster
      ? { large: poster, extraLarge: poster, color: null }
      : null,
    bannerImage: poster,
    genres: [...(item.genres ?? []), ...(item.themes ?? [])]
      .map((genre) => normalizeJikanGenre(genre?.name))
      .filter((genre): genre is string => genre !== null),
    averageScore:
      typeof item.score === "number" && item.score > 0
        ? Math.round(item.score * 10) / 10
        : null,
    popularity: item.popularity ?? item.favorites ?? item.scored_by ?? null,
    trending: item.rank ?? null,
    isAdult:
      item.rating?.toLowerCase().includes("rx") === true ||
      (item.explicit_genres?.length ?? 0) > 0,
    startDate:
      year !== null
        ? {
            year,
            month: Number.isInteger(month) ? month : null,
            day: Number.isInteger(day) ? day : null,
          }
        : null,
    seasonYear: year,
    siteUrl: item.url ?? `https://myanimelist.net/anime/${malId}`,
  };
};

const jikanTypeForAnilistFormat = (
  format?: string,
): "tv" | "movie" | "ova" | "special" | "ona" | "music" | undefined => {
  switch (format?.toUpperCase()) {
    case "TV":
      return "tv";
    case "MOVIE":
      return "movie";
    case "OVA":
      return "ova";
    case "ONA":
      return "ona";
    case "SPECIAL":
      return "special";
    case "MUSIC":
      return "music";
    default:
      return undefined;
  }
};

const jikanStatusForAnilistStatus = (
  status?: string,
): "airing" | "complete" | "upcoming" | undefined => {
  switch (status) {
    case "RELEASING":
      return "airing";
    case "FINISHED":
      return "complete";
    case "NOT_YET_RELEASED":
      return "upcoming";
    default:
      return undefined;
  }
};

/**
 * Last-resort catalog fallback. Genre filtering is client-side here because
 * Jikan has no multi-genre `genre_in` equivalent for AniList names (only MAL
 * numeric ids, which drift). Season/year has no Jikan equivalent either; a
 * year mismatch filters the row out.
 */
export const fetchJikanAnimeFallbackPage = async ({
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
    fetchJikanAnimeFallbackPageEffect({ page, perPage, params, reason }),
  ).catch(() => null);

export const fetchJikanAnimeFallbackPageEffect = ({
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
    if (params.genres.includes("Hentai")) {
      return null;
    }

    // No search query and sortable browse: `/top/anime` is cheaper + cached.
    const result = params.query
      ? yield* fetchJikanAnimePageEffect({
          page,
          perPage,
          search: params.query,
          orderBy: params.sort === "SCORE_DESC" ? "score" : "members",
          status: jikanStatusForAnilistStatus(params.status),
          type: jikanTypeForAnilistFormat(params.format),
        })
      : yield* fetchJikanTopAnimePageEffect({
          page,
          perPage,
          type: jikanTypeForAnilistFormat(params.format),
          filter:
            params.sort === "FAVOURITES_DESC"
              ? "favorite"
              : params.status === "RELEASING"
                ? "airing"
                : params.status === "NOT_YET_RELEASED"
                  ? "upcoming"
                  : "bypopularity",
        });

    if (!result || result.items.length === 0) {
      yield* Effect.sync(() =>
        console.warn(
          `Jikan anime fallback empty${reason ? ` (${reason})` : ""}; no further fallbacks.`,
        ),
      );
      return null;
    }

    const wantedGenres = new Set(params.genres);
    const media: AniListMedia[] = [];
    for (const item of result.items) {
      const mapped = jikanItemToAniListMedia(item);
      if (!mapped) continue;
      if (
        wantedGenres.size > 0 &&
        !mapped.genres?.some((genre) => wantedGenres.has(genre))
      ) {
        continue;
      }
      if (
        Number.isInteger(params.year) &&
        mapped.seasonYear !== null &&
        mapped.seasonYear !== params.year
      ) {
        continue;
      }
      media.push(mapped);
    }

    if (media.length === 0) {
      yield* Effect.sync(() =>
        console.warn(
          `Jikan anime fallback filtered to empty${reason ? ` (${reason})` : ""}; no further fallbacks.`,
        ),
      );
      return null;
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
  });
