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
  // Above-fold data is intentionally slimmer than the full detail payload, so
  // seed only the above-fold key. The full `tvDetails` query fetches the
  // complete record (companies, languages, etc.) on its own.
  queryClient.setQueryData(queryKeys.mediaAboveFold("tv", id), details);
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
  // Above-fold data is intentionally slimmer than the full detail payload, so
  // seed only the above-fold key. The full `movieDetails` query fetches the
  // complete record (budget, companies, original language, etc.) on its own.
  queryClient.setQueryData(queryKeys.mediaAboveFold("movie", id), movie);
}
