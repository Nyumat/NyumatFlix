import { CACHE_REVALIDATE_SECONDS } from "@/lib/http-cache";
import { fetchTVShowDetails } from "@/lib/server/tvshow-api";
import type { MediaItem } from "@/lib/domain/typings";
import { cache } from "react";

export const getCachedMovieDetail = cache(
  async (id: string): Promise<MediaItem | null> => {
    try {
      const baseUrl = `https://api.themoviedb.org/3/movie/${id}?api_key=${process.env.TMDB_API_KEY}&language=en-US`;
      const fetchOptions = { next: { revalidate: CACHE_REVALIDATE_SECONDS } };

      const [res1, res2, res3] = await Promise.all([
        fetch(
          `${baseUrl}&append_to_response=keywords,external_ids`,
          fetchOptions,
        ),
        fetch(
          `${baseUrl}&append_to_response=videos,images,credits`,
          fetchOptions,
        ),
        fetch(
          `${baseUrl}&append_to_response=recommendations,similar,reviews`,
          fetchOptions,
        ),
      ]);

      if (!res1.ok || !res2.ok || !res3.ok) {
        return null;
      }

      const [data1, data2, data3] = await Promise.all([
        res1.json(),
        res2.json(),
        res3.json(),
      ]);

      const data = {
        ...data1,
        ...data2,
        ...data3,
      };

      const { fetchAndEnrichMediaItems } = await import("@/lib/server/actions");
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
