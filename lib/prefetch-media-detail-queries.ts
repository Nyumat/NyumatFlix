import {
  getCachedAnilistTvAllSeasons,
  getCachedAnilistTvCredits,
  getCachedAnilistTvRecommendations,
  getCachedAnilistTvShowDetail,
} from "@/lib/anilist-tv-detail";
import { isAnilistTvRouteId } from "@/lib/anilist-route-id";
import { fetchAllSeasonDetails } from "@/lib/server/tvshow-api";
import type { MediaAboveFoldDetail } from "@/lib/media-above-fold";
import { queryKeys } from "@/lib/query-keys";
import { tmdb } from "@/tmdb/api";
import type { MediaItem, TvShowDetails } from "@/lib/domain/typings";
import type { QueryClient } from "@tanstack/react-query";

export async function prefetchTvShowTabQueries(
  queryClient: QueryClient,
  id: string,
) {
  if (isAnilistTvRouteId(id)) {
    const [credits, recommendations, seasons, details] = await Promise.all([
      getCachedAnilistTvCredits(id),
      getCachedAnilistTvRecommendations(id),
      getCachedAnilistTvAllSeasons(id),
      getCachedAnilistTvShowDetail(id),
    ]);

    queryClient.setQueryData(queryKeys.tvTabCredits(id), credits);
    queryClient.setQueryData(
      queryKeys.tvTabRecommendations(id, "1"),
      recommendations,
    );
    queryClient.setQueryData(queryKeys.tvAllSeasons(id), seasons);
    if (details) {
      queryClient.setQueryData(queryKeys.tvDetailsRoute(id), details);
    }
    queryClient.setQueryData(queryKeys.tvTabImages(id), {
      backdrops: [],
      posters: [],
      logos: [],
    });
    queryClient.setQueryData(
      queryKeys.tvTabVideos(id),
      details?.videos ?? { results: [] },
    );
    queryClient.setQueryData(queryKeys.tvTabReviews(id, "1"), {
      page: 1,
      results: [],
      total_pages: 0,
      total_results: 0,
    });
    queryClient.setQueryData(queryKeys.tvTabSimilar(id, "1"), {
      page: 1,
      results: [],
      total_pages: 0,
      total_results: 0,
    });
    return;
  }

  const existingDetails = queryClient.getQueryData<TvShowDetails>(
    queryKeys.tvDetails(Number.parseInt(id, 10)),
  );
  const [credits, images, videos, reviews, recommendations, similar, seasons] =
    await Promise.all([
      tmdb.tv.credits({ id }),
      tmdb.tv.images({ id, langs: "en,null" }),
      tmdb.tv.videos({ id }),
      tmdb.tv.reviews({ id, page: "1" }),
      tmdb.tv.recommendations({ id, page: "1" }),
      tmdb.tv.similar({ id, page: "1" }),
      existingDetails
        ? fetchAllSeasonDetails(id, existingDetails.seasons)
        : Promise.resolve({}),
    ]);

  queryClient.setQueryData(queryKeys.tvTabCredits(id), credits);
  queryClient.setQueryData(queryKeys.tvTabImages(id), images);
  queryClient.setQueryData(queryKeys.tvTabVideos(id), videos);
  queryClient.setQueryData(queryKeys.tvTabReviews(id, "1"), reviews);
  queryClient.setQueryData(
    queryKeys.tvTabRecommendations(id, "1"),
    recommendations,
  );
  queryClient.setQueryData(queryKeys.tvTabSimilar(id, "1"), similar);
  queryClient.setQueryData(queryKeys.tvAllSeasons(id), seasons);
}

export async function hydrateTvShowDetailQueries(
  queryClient: QueryClient,
  id: string,
  details: TvShowDetails | MediaAboveFoldDetail,
) {
  queryClient.setQueryData(queryKeys.mediaAboveFold("tv", id), details);
  if (isAnilistTvRouteId(id)) {
    queryClient.setQueryData(queryKeys.tvDetailsRoute(id), details);
  }
}

export async function prefetchMovieTabQueries(
  queryClient: QueryClient,
  id: string,
) {
  const [credits, images, videos, reviews, recommendations, similar] =
    await Promise.all([
      tmdb.movie.credits({ id }),
      tmdb.movie.images({ id, langs: "en,null" }),
      tmdb.movie.videos({ id }),
      tmdb.movie.reviews({ id, page: "1" }),
      tmdb.movie.recommendations({ id, page: "1" }),
      tmdb.movie.similar({ id, page: "1" }),
    ]);

  queryClient.setQueryData(queryKeys.movieTabCredits(id), credits);
  queryClient.setQueryData(queryKeys.movieTabImages(id), images);
  queryClient.setQueryData(queryKeys.movieTabVideos(id), videos);
  queryClient.setQueryData(queryKeys.movieTabReviews(id, "1"), reviews);
  queryClient.setQueryData(
    queryKeys.movieTabRecommendations(id, "1"),
    recommendations,
  );
  queryClient.setQueryData(queryKeys.movieTabSimilar(id, "1"), similar);
}

export async function hydrateMovieDetailQueries(
  queryClient: QueryClient,
  id: string,
  movie: MediaItem | MediaAboveFoldDetail,
) {
  queryClient.setQueryData(queryKeys.mediaAboveFold("movie", id), movie);
}
