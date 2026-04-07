import { fetchTVShowDetails } from "@/components/tvshow/tvshow-api";
import type { MediaItem } from "@/utils/typings";
import { cache } from "react";

export const getCachedMovieDetail = cache(
  async (id: string): Promise<MediaItem | null> => {
    try {
      const response = await fetch(
        `https://api.themoviedb.org/3/movie/${id}?api_key=${process.env.TMDB_API_KEY}&language=en-US&append_to_response=videos,images,credits,recommendations,similar,keywords,reviews`,
      );
      if (!response.ok) {
        return null;
      }
      const data = await response.json();
      const { fetchAndEnrichMediaItems } = await import("@/app/actions");
      const enrichedData = await fetchAndEnrichMediaItems([data], "movie");
      return enrichedData[0] ?? null;
    } catch {
      return null;
    }
  },
);

export const getCachedTvShowDetail = cache((id: string) =>
  fetchTVShowDetails(id),
);
