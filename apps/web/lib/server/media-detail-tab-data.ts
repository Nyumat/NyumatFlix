import "server-only";

import {
  fetchSeasonDetailsServer,
  getCachedAllSeasonDetailsForShow,
} from "@/lib/server/tvshow-api";
import {
  getCachedTmdbResponse,
  tmdbTvCacheTag,
} from "@/lib/server/tmdb-response-cache";
import { unwrapTmdbLookupId } from "@/lib/tmdb-anime-route-id";
import {
  getCachedMovieDetail,
  getCachedTvShowDetail,
} from "@/lib/media-detail-cache";
import type { TvDetailCatalog } from "@/lib/tv-detail-catalog";
import type { TvShowDetails } from "@/lib/domain/typings";
import { tmdb } from "@/tmdb/api";

export async function fetchCollectionDetails(collectionId: number) {
  return tmdb.collection.details({ id: collectionId });
}

export async function getTvShowDetailsForQuery(id: string) {
  return getCachedTvShowDetail(id);
}

export async function getTvSeasonForQuery(
  id: string,
  seasonNumber: number,
  catalog: TvDetailCatalog | null = null,
) {
  const routeId = unwrapTmdbLookupId(id);
  return getCachedTmdbResponse({
    cacheKey: `tv-season:${routeId}:${seasonNumber}`,
    tags: [tmdbTvCacheTag(routeId)],
    revalidateSeconds: 3600,
    memoryFallback: true,
    load: () =>
      fetchSeasonDetailsServer(id, seasonNumber, {
        catalog: catalog ?? undefined,
      }),
  });
}

export async function getTvAllSeasonsForQuery(
  id: string,
  prefetchedDetails?: TvShowDetails | null,
  catalog: TvDetailCatalog | null = null,
) {
  if (
    prefetchedDetails?.allSeasonDetails &&
    Object.keys(prefetchedDetails.allSeasonDetails).length > 0
  ) {
    return prefetchedDetails.allSeasonDetails;
  }

  const details = prefetchedDetails ?? (await getCachedTvShowDetail(id, {
    animeCatalog: catalog === "anime",
  }));
  if (!details) {
    return {};
  }

  return getCachedAllSeasonDetailsForShow(id, details.seasons, { catalog });
}

export async function getMovieDetailsForQuery(id: string) {
  return getCachedMovieDetail(id);
}

export async function fetchTvReviewsPage(id: string, page: string) {
  return tmdb.tv.reviews({ id, page });
}

export async function fetchTvRecommendationsPage(id: string, page: string) {
  return tmdb.tv.recommendations({ id, page });
}

export async function fetchTvSimilarPage(id: string, page: string) {
  return tmdb.tv.similar({ id, page });
}

export async function fetchTvCredits(id: string) {
  return tmdb.tv.credits({ id });
}

export async function fetchTvImages(id: string) {
  return tmdb.tv.images({ id, langs: "en,null" });
}

export async function fetchTvVideos(id: string) {
  return tmdb.tv.videos({ id });
}

export async function fetchMovieReviewsPage(id: string, page: string) {
  return tmdb.movie.reviews({ id, page });
}

export async function fetchMovieRecommendationsPage(id: string, page: string) {
  return tmdb.movie.recommendations({ id, page });
}

export async function fetchMovieSimilarPage(id: string, page: string) {
  return tmdb.movie.similar({ id, page });
}

export async function fetchMovieCredits(id: string) {
  return tmdb.movie.credits({ id });
}

export async function fetchMovieImages(id: string) {
  return tmdb.movie.images({ id, langs: "en,null" });
}

export async function fetchMovieVideos(id: string) {
  return tmdb.movie.videos({ id });
}
