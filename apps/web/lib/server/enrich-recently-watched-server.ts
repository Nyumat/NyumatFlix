import "server-only";

import {
  getCachedAnilistTvMedia,
  getCachedAnilistTvShowDetail,
  type AniListTvMedia,
} from "@/lib/anilist-tv-detail";
import { getTmdbIdFromFribb } from "@/lib/fribb-mapping";
import {
  getCachedMovieDetail,
  getCachedTvShowDetail,
} from "@/lib/media-detail-cache";
import type {
  MovieDetailForEnrichment,
  RecentlyWatchedEnrichmentFetchers,
  TvDetailForEnrichment,
} from "@/lib/playback/enrich-recently-watched";
import { shouldPreferAnilistWatchlistMedia } from "@/lib/watchlist/anilist-watchlist-id";
import { isAnime } from "@/utils/anilist-helpers";

export type TvDetailEnrichmentResult = {
  detail: TvDetailForEnrichment;
  catalog: "anime" | null;
} | null;

export type TvDetailFetcher = (
  contentId: number,
) => Promise<TvDetailEnrichmentResult>;

const readTvDetailName = (
  detail: TvDetailForEnrichment | null | undefined,
): string | null => {
  if (!detail || !("name" in detail) || typeof detail.name !== "string") {
    return null;
  }

  return detail.name;
};

const loadAnilistBackedTvDetail = async (
  contentId: number,
  mappedTmdbId: number | null,
): Promise<TvDetailEnrichmentResult> => {
  let anilistMedia: AniListTvMedia | null = null;
  try {
    anilistMedia = await getCachedAnilistTvMedia(contentId);
  } catch {
    anilistMedia = null;
  }

  const tmdbLookupId = mappedTmdbId ?? contentId;
  const [tmdbDetail, anilistDetail] = await Promise.all([
    getCachedTvShowDetail(String(tmdbLookupId), {
      append: "shell",
    }),
    anilistMedia
      ? getCachedAnilistTvShowDetail(String(contentId), {
          acceptBareNumeric: true,
        })
      : Promise.resolve(null),
  ]);

  const tmdbName = readTvDetailName(tmdbDetail);

  if (
    anilistDetail &&
    anilistMedia &&
    shouldPreferAnilistWatchlistMedia({
      anilistMedia,
      tmdbTitle: tmdbName,
      tmdbFetchSucceeded: Boolean(tmdbName),
      mappedTmdbId,
      contentId,
    })
  ) {
    return { detail: anilistDetail, catalog: "anime" };
  }

  if (tmdbDetail && tmdbName) {
    return { detail: tmdbDetail, catalog: null };
  }

  if (anilistDetail) {
    return { detail: anilistDetail, catalog: "anime" };
  }

  return null;
};

const loadTvDetailForEnrichment = async (
  contentId: number,
): Promise<TvDetailEnrichmentResult> => {
  let mappedTmdbId: number | null = null;
  try {
    const mappedRoute = await getTmdbIdFromFribb(contentId);
    mappedTmdbId =
      mappedRoute?.type === "tv" && mappedRoute.id > 0 ? mappedRoute.id : null;
  } catch {
    mappedTmdbId = null;
  }

  if (mappedTmdbId != null && mappedTmdbId !== contentId) {
    return loadAnilistBackedTvDetail(contentId, mappedTmdbId);
  }

  const tmdbDetail = await getCachedTvShowDetail(String(contentId), {
    append: "shell",
  });
  const tmdbName = readTvDetailName(tmdbDetail);
  if (tmdbDetail && tmdbName) {
    return { detail: tmdbDetail, catalog: null };
  }

  return loadAnilistBackedTvDetail(contentId, mappedTmdbId);
};

export const createTvDetailFetcher = (): TvDetailFetcher => {
  const pending = new Map<number, Promise<TvDetailEnrichmentResult>>();

  return (contentId: number) => {
    const existing = pending.get(contentId);
    if (existing) {
      return existing;
    }

    const promise = loadTvDetailForEnrichment(contentId);
    pending.set(contentId, promise);
    return promise;
  };
};

export const fetchTvDetailForEnrichment = loadTvDetailForEnrichment;

const fetchServerMovieDetail = async (
  contentId: number,
): Promise<MovieDetailForEnrichment | null> => {
  const detail = await getCachedMovieDetail(String(contentId), {
    append: "shell",
  });
  if (!detail) {
    return null;
  }

  if ("title" in detail && typeof detail.title === "string") {
    return {
      title: detail.title,
      backdrop_path: detail.backdrop_path,
      poster_path: detail.poster_path,
      vote_average: detail.vote_average,
      release_date: detail.release_date,
    };
  }

  return null;
};

export const createServerRecentlyWatchedEnrichmentFetchers = (
  fetchTv: TvDetailFetcher,
): RecentlyWatchedEnrichmentFetchers => ({
  fetchMovie: fetchServerMovieDetail,
  fetchTv: async (stub) => fetchTv(stub.contentId),
  isAnimeTvDetail: (detail) => isAnime(detail),
});

export const serverRecentlyWatchedEnrichmentFetchers: RecentlyWatchedEnrichmentFetchers =
  createServerRecentlyWatchedEnrichmentFetchers(fetchTvDetailForEnrichment);
