import {
  isAnilistBackedTvRouteId,
  type TvDetailCatalog,
} from "@/lib/tv-detail-catalog";
import type { MediaAboveFoldDetail } from "@/lib/media-above-fold";
import { queryKeys } from "@/lib/query-keys";
import type { MediaItem, TvShowDetails } from "@/lib/domain/typings";
import type { QueryClient } from "@tanstack/react-query";

function isFullMovieItem(
  movie: MediaItem | MediaAboveFoldDetail,
): movie is MediaItem {
  return "title" in movie && typeof movie.title === "string";
}

function isFullTvDetails(
  details: TvShowDetails | MediaAboveFoldDetail,
): details is TvShowDetails {
  return "name" in details && typeof details.name === "string";
}

export async function hydrateMovieDetailQueries(
  queryClient: QueryClient,
  id: string,
  movie: MediaItem | MediaAboveFoldDetail,
) {
  queryClient.setQueryData(queryKeys.mediaAboveFold("movie", id), movie);

  if (!isFullMovieItem(movie)) {
    return;
  }

  const numId = Number.parseInt(id, 10);
  if (!Number.isNaN(numId)) {
    queryClient.setQueryData(queryKeys.movieDetails(numId), movie);
  }

  if (movie.credits) {
    queryClient.setQueryData(queryKeys.movieTabCredits(id), movie.credits);
  }

  if (movie.recommendations) {
    queryClient.setQueryData(
      queryKeys.movieTabRecommendations(id, "1"),
      movie.recommendations,
    );
  }

  if (movie.images) {
    queryClient.setQueryData(queryKeys.movieTabImages(id), movie.images);
  }

  if (movie.videos) {
    queryClient.setQueryData(queryKeys.movieTabVideos(id), movie.videos);
  }

  if (movie.reviews) {
    queryClient.setQueryData(queryKeys.movieTabReviews(id, "1"), movie.reviews);
  }

  if (movie.similar) {
    queryClient.setQueryData(queryKeys.movieTabSimilar(id, "1"), movie.similar);
  }
}

export async function hydrateTvShowDetailQueries(
  queryClient: QueryClient,
  id: string,
  details: TvShowDetails | MediaAboveFoldDetail,
  catalog: TvDetailCatalog = "tvshows",
) {
  queryClient.setQueryData(queryKeys.mediaAboveFold("tv", id), details);

  if (!isFullTvDetails(details)) {
    return;
  }

  if (isAnilistBackedTvRouteId(id, catalog)) {
    queryClient.setQueryData(queryKeys.tvDetailsRoute(id), details);
  } else {
    const numId = Number.parseInt(id, 10);
    if (!Number.isNaN(numId)) {
      queryClient.setQueryData(queryKeys.tvDetails(numId), details);
    }
  }

  if (details.credits) {
    queryClient.setQueryData(queryKeys.tvTabCredits(id), details.credits);
  }

  if (details.recommendations) {
    queryClient.setQueryData(
      queryKeys.tvTabRecommendations(id, "1"),
      details.recommendations,
    );
  }

  if (details.images) {
    queryClient.setQueryData(queryKeys.tvTabImages(id), details.images);
  }

  if (details.videos) {
    queryClient.setQueryData(queryKeys.tvTabVideos(id), details.videos);
  }

  if (details.reviews) {
    queryClient.setQueryData(queryKeys.tvTabReviews(id, "1"), details.reviews);
  }

  if (details.similar) {
    queryClient.setQueryData(queryKeys.tvTabSimilar(id, "1"), details.similar);
  }
}
