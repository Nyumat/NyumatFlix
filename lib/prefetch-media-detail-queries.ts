import { queryKeys } from "@/lib/query-keys";
import { tmdb } from "@/tmdb/api";
import type { MediaItem, SeasonDetails, TvShowDetails } from "@/utils/typings";
import type { QueryClient } from "@tanstack/react-query";

export async function prefetchTvShowTabQueries(
  queryClient: QueryClient,
  id: string,
) {
  const [credits, images, videos, reviews, recommendations, similar] =
    await Promise.all([
      tmdb.tv.credits({ id }),
      tmdb.tv.images({ id, langs: "en,null" }),
      tmdb.tv.videos({ id }),
      tmdb.tv.reviews({ id, page: "1" }),
      tmdb.tv.recommendations({ id, page: "1" }),
      tmdb.tv.similar({ id, page: "1" }),
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
}

export async function hydrateTvShowDetailQueries(
  queryClient: QueryClient,
  id: string,
  details: TvShowDetails,
  allSeasonDetails: Record<number, SeasonDetails>,
) {
  const numId = Number.parseInt(id, 10);
  queryClient.setQueryData(queryKeys.tvDetails(numId), details);
  queryClient.setQueryData(queryKeys.tvAllSeasons(id), allSeasonDetails);
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
  movie: MediaItem,
) {
  const numId = Number.parseInt(id, 10);
  queryClient.setQueryData(queryKeys.movieDetails(numId), movie);
}
