import "server-only";

import { resolveAnilistTvTmdbRoute } from "@/lib/anilist-tmdb-route";
import {
  getCachedAnilistTvMedia,
  type AniListTvMedia,
} from "@/lib/anilist-tv-detail";
import { MediaItemSchema, type MediaItem } from "@/lib/domain/typings";
import type { WatchlistItem } from "@/lib/domain/watchlist";
import { runInChunks } from "@/lib/server/chunked-parallel";
import { shouldPreferAnilistWatchlistMedia } from "@/lib/watchlist/anilist-watchlist-id";
import { tmdb } from "@/tmdb/api";
import { cache } from "react";

export type WatchlistMediaItem = MediaItem & {
  media_type: "movie" | "tv";
  watchlistItem: WatchlistItem;
  isUnavailable?: boolean;
  sourceAnilistId?: number;
};

type TmdbDetailGenre = {
  id: number;
  name?: string;
};

function normalizeTmdbDetailForWatchlist(
  data: unknown,
  item: WatchlistItem,
): unknown {
  if (!data || typeof data !== "object") {
    return data;
  }

  const detail = data as {
    id?: number;
    title?: string;
    name?: string;
    overview?: string;
    genres?: TmdbDetailGenre[];
    genre_ids?: number[];
    media_type?: "movie" | "tv";
    original_language?: string;
    original_title?: string;
    original_name?: string;
    popularity?: number;
    vote_average?: number;
    vote_count?: number;
    adult?: boolean;
    video?: boolean;
  };

  const effectiveId = detail.id ?? item.contentId;
  const rawTitle = detail.title ?? detail.name;
  if (!rawTitle) {
    return null;
  }

  const isMovie = item.mediaType === "movie";

  return {
    ...detail,
    id: effectiveId,
    media_type: item.mediaType,
    title: isMovie ? rawTitle : detail.title,
    name: !isMovie ? rawTitle : detail.name,
    overview: detail.overview ?? "",
    original_language: detail.original_language ?? "en",
    original_title: isMovie ? (detail.original_title ?? rawTitle) : undefined,
    original_name: !isMovie ? (detail.original_name ?? rawTitle) : undefined,
    popularity: detail.popularity ?? 0,
    vote_average: detail.vote_average ?? 0,
    vote_count: detail.vote_count ?? 0,
    adult: detail.adult ?? false,
    video: detail.video ?? false,
    genre_ids:
      detail.genre_ids ??
      detail.genres
        ?.map((genre) => genre.id)
        .filter((id): id is number => typeof id === "number") ??
      [],
  };
}

function createFallbackWatchlistMediaItem(
  item: WatchlistItem,
): WatchlistMediaItem {
  const isMovie = item.mediaType === "movie";
  return {
    id: item.contentId,
    title: `Unavailable ${isMovie ? "Movie" : "TV Show"} #${item.contentId}`,
    name: `Unavailable ${isMovie ? "Movie" : "TV Show"} #${item.contentId}`,
    overview:
      "Media details could not be retrieved from TMDB or AniList for this saved title.",
    media_type: item.mediaType,
    poster_path: null,
    backdrop_path: null,
    genre_ids: [],
    popularity: 0,
    vote_average: 0,
    vote_count: 0,
    adult: false,
    video: false,
    original_language: "en",
    original_title: `Unavailable #${item.contentId}`,
    original_name: `Unavailable #${item.contentId}`,
    watchlistItem: item,
    isUnavailable: true,
  } as WatchlistMediaItem;
}

function buildAnilistWatchlistMediaItem(
  item: WatchlistItem,
  anilistMedia: AniListTvMedia,
): WatchlistMediaItem {
  const title =
    anilistMedia.title.english ||
    anilistMedia.title.romaji ||
    anilistMedia.title.native ||
    `Anime #${item.contentId}`;

  return {
    id: item.contentId,
    title,
    name: title,
    overview: anilistMedia.description?.replace(/<[^>]*>/g, "") || "",
    media_type: item.mediaType,
    poster_path:
      anilistMedia.coverImage?.extraLarge ||
      anilistMedia.coverImage?.large ||
      null,
    backdrop_path: anilistMedia.bannerImage || null,
    genre_ids: [16],
    popularity: 0,
    vote_average: anilistMedia.averageScore
      ? anilistMedia.averageScore / 10
      : 0,
    vote_count: 0,
    adult: anilistMedia.isAdult ?? false,
    video: false,
    original_language: "ja",
    original_title: anilistMedia.title.romaji || title,
    original_name: anilistMedia.title.romaji || title,
    first_air_date: anilistMedia.startDate?.year
      ? `${anilistMedia.startDate.year}-01-01`
      : undefined,
    watchlistItem: item,
    sourceAnilistId: item.contentId,
  } as WatchlistMediaItem;
}

function parseTmdbWatchlistMediaItem(
  data: unknown,
  item: WatchlistItem,
): WatchlistMediaItem | null {
  const normalized = normalizeTmdbDetailForWatchlist(data, item);
  if (!normalized) {
    return null;
  }

  const parsed = MediaItemSchema.safeParse(normalized);
  if (!parsed.success) {
    return null;
  }

  return {
    ...parsed.data,
    media_type: item.mediaType,
    watchlistItem: item,
  };
}

async function fetchTvWatchlistMediaDetail(
  item: WatchlistItem,
): Promise<WatchlistMediaItem> {
  let tmdbData: unknown = null;
  let tmdbTitle: string | null = null;
  let tmdbFetchSucceeded = false;

  try {
    tmdbData = await tmdb.tv.detail({ id: String(item.contentId) });
    const detail = tmdbData as { title?: string; name?: string };
    tmdbTitle = detail.name ?? detail.title ?? null;
    tmdbFetchSucceeded = Boolean(tmdbTitle);
  } catch (error) {
    console.error(
      `Error fetching TMDB detail for tv ${item.contentId}:`,
      error,
    );
  }

  let anilistMedia: AniListTvMedia | null = null;
  try {
    anilistMedia = await getCachedAnilistTvMedia(item.contentId);
  } catch {
    anilistMedia = null;
  }

  let mappedTmdbId: number | null = null;
  if (anilistMedia) {
    try {
      const mappedRoute = await resolveAnilistTvTmdbRoute(item.contentId);
      mappedTmdbId =
        mappedRoute?.type === "tv" && mappedRoute.id > 0
          ? mappedRoute.id
          : null;
    } catch {
      mappedTmdbId = null;
    }
  }

  if (
    shouldPreferAnilistWatchlistMedia({
      anilistMedia,
      tmdbTitle,
      tmdbFetchSucceeded,
      mappedTmdbId,
      contentId: item.contentId,
    }) &&
    anilistMedia
  ) {
    const anilistItem = buildAnilistWatchlistMediaItem(item, anilistMedia);

    if (mappedTmdbId != null && mappedTmdbId !== item.contentId) {
      try {
        const mappedTmdbData = await tmdb.tv.detail({
          id: String(mappedTmdbId),
        });
        const mappedItem = parseTmdbWatchlistMediaItem(mappedTmdbData, item);
        if (mappedItem) {
          return {
            ...anilistItem,
            poster_path: mappedItem.poster_path ?? anilistItem.poster_path,
            backdrop_path:
              mappedItem.backdrop_path ?? anilistItem.backdrop_path,
            vote_average:
              mappedItem.vote_average > 0
                ? mappedItem.vote_average
                : anilistItem.vote_average,
          };
        }
      } catch {
        // Fall back to pure AniList metadata below.
      }
    }

    return anilistItem;
  }

  if (tmdbData) {
    const parsed = parseTmdbWatchlistMediaItem(tmdbData, item);
    if (parsed) {
      return parsed;
    }
  }

  if (anilistMedia) {
    return buildAnilistWatchlistMediaItem(item, anilistMedia);
  }

  return createFallbackWatchlistMediaItem(item);
}

const fetchWatchlistMediaDetail = cache(
  async (item: WatchlistItem): Promise<WatchlistMediaItem> => {
    if (item.mediaType === "tv") {
      return fetchTvWatchlistMediaDetail(item);
    }

    try {
      const data = await tmdb.movie.detail({ id: String(item.contentId) });
      const parsed = parseTmdbWatchlistMediaItem(data, item);
      if (parsed) {
        return parsed;
      }
    } catch (error) {
      console.error(
        `Error fetching TMDB detail for movie ${item.contentId}:`,
        error,
      );
    }

    return createFallbackWatchlistMediaItem(item);
  },
);

export async function fetchWatchlistMediaItems(
  watchlistItems: WatchlistItem[],
): Promise<WatchlistMediaItem[]> {
  if (watchlistItems.length === 0) {
    return [];
  }

  const results = await runInChunks(watchlistItems, (item) =>
    fetchWatchlistMediaDetail(item),
  );

  return results.filter((item): item is WatchlistMediaItem => item !== null);
}
