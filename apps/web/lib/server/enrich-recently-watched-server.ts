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
import { resolveTmdbShowToAnilistId } from "@/lib/anime/cross-id-resolver";
import { enrichLocalizedCatalogBackdrops } from "@/lib/server/enrich-catalog-backdrops";
import { isAnime } from "@/utils/anilist-helpers";

export type TvDetailEnrichmentResult = {
  detail: TvDetailForEnrichment;
  catalog: "anime" | null;
  /** Verified AniList id, when the id space of `contentId`/mapping is known. */
  sourceAnilistId?: number | null;
} | null;

export type TvDetailFetcher = (
  contentId: number,
  seasonNumber?: number | null,
) => Promise<TvDetailEnrichmentResult>;

const withLocalizedTmdbBackdrop = async <
  T extends { id?: number; backdrop_path?: string | null },
>(
  detail: T,
  mediaType: "movie" | "tv",
  fallbackId: number,
): Promise<T> => {
  const id =
    typeof detail.id === "number" && detail.id > 0 ? detail.id : fallbackId;
  const [enriched] = await enrichLocalizedCatalogBackdrops([
    {
      id,
      media_type: mediaType,
      backdrop_path: detail.backdrop_path,
    },
  ]);
  if (
    !enriched?.backdrop_path ||
    enriched.backdrop_path === detail.backdrop_path
  ) {
    return detail;
  }

  return { ...detail, backdrop_path: enriched.backdrop_path };
};

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
    return {
      detail: await withLocalizedTmdbBackdrop(tmdbDetail, "tv", tmdbLookupId),
      catalog: null,
    };
  }

  if (anilistDetail) {
    return { detail: anilistDetail, catalog: "anime" };
  }

  return null;
};

const loadTvDetailForEnrichment = async (
  contentId: number,
  seasonNumber?: number | null,
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
    // `contentId` resolved as an AniList id via Fribb — carry it so anime
    // hrefs can trust it even when the TMDB detail wins for display.
    const result = await loadAnilistBackedTvDetail(contentId, mappedTmdbId);
    return result ? { ...result, sourceAnilistId: contentId } : null;
  }

  const tmdbDetail = await getCachedTvShowDetail(String(contentId), {
    append: "shell",
  });
  const tmdbName = readTvDetailName(tmdbDetail);
  if (tmdbDetail && tmdbName) {
    const localizedDetail = await withLocalizedTmdbBackdrop(
      tmdbDetail,
      "tv",
      contentId,
    );
    if (isAnime(localizedDetail)) {
      // Genre-detected anime on a TMDB id: `contentId` is NOT an AniList id.
      // Resolve the real mapping (cached) or leave null — the href then
      // stays on the TMDB experience instead of fabricating /anime/anilist-<tmdbId>.
      let sourceAnilistId: number | null = null;
      try {
        sourceAnilistId = await resolveTmdbShowToAnilistId(
          contentId,
          seasonNumber,
        );
      } catch {
        sourceAnilistId = null;
      }
      return { detail: localizedDetail, catalog: null, sourceAnilistId };
    }

    return { detail: localizedDetail, catalog: null };
  }

  const result = await loadAnilistBackedTvDetail(contentId, mappedTmdbId);
  return result ? { ...result, sourceAnilistId: contentId } : null;
};

export const createTvDetailFetcher = (): TvDetailFetcher => {
  const pending = new Map<string, Promise<TvDetailEnrichmentResult>>();

  return (contentId: number, seasonNumber?: number | null) => {
    const cacheKey = `${contentId}:${seasonNumber ?? ""}`;
    const existing = pending.get(cacheKey);
    if (existing) {
      return existing;
    }

    const promise = loadTvDetailForEnrichment(contentId, seasonNumber);
    pending.set(cacheKey, promise);
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
    const localized = await withLocalizedTmdbBackdrop(
      detail,
      "movie",
      contentId,
    );
    return {
      title: detail.title,
      backdrop_path: localized.backdrop_path,
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
  fetchTv: async (stub) => fetchTv(stub.contentId, stub.seasonNumber),
  isAnimeTvDetail: (detail) => isAnime(detail),
});

export const serverRecentlyWatchedEnrichmentFetchers: RecentlyWatchedEnrichmentFetchers =
  createServerRecentlyWatchedEnrichmentFetchers(fetchTvDetailForEnrichment);
