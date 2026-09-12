import type { MediaAboveFoldDetail } from "@/lib/media-above-fold";
import { queryKeys } from "@/lib/query-keys";
import type { MediaItem, TvShowDetails } from "@/lib/domain/typings";
import type { QueryClient } from "@tanstack/react-query";

function isFullMovieItem(
  movie: MediaItem | MediaAboveFoldDetail,
): movie is MediaItem {
  return "title" in movie && typeof movie.title === "string";
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
}

export type { TvShowDetails };
