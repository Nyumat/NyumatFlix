import { fetchTvShowDetailClient } from "@/lib/tv-show-detail-client";
import { isAnime } from "@/utils/anilist-helpers";
import type {
  MovieDetailForEnrichment,
  RecentlyWatchedEnrichmentFetchers,
} from "@/lib/playback/enrich-recently-watched";
import type { RecentlyWatchedStub } from "@/lib/playback/recently-watched";

const fetchClientMovieDetail = async (
  contentId: number,
): Promise<MovieDetailForEnrichment | null> => {
  const response = await fetch(`/api/movies/${contentId}`);
  if (!response.ok) {
    return null;
  }

  return (await response.json()) as MovieDetailForEnrichment;
};

export const clientRecentlyWatchedEnrichmentFetchers: RecentlyWatchedEnrichmentFetchers =
  {
    fetchMovie: fetchClientMovieDetail,
    fetchTv: async (stub: RecentlyWatchedStub) => {
      const fetched = await fetchTvShowDetailClient(stub.contentId, {
        expectedTitle: stub.title,
      });
      if (!fetched) {
        return null;
      }

      return {
        detail: fetched.detail,
        catalog: fetched.catalog,
      };
    },
    isAnimeTvDetail: (detail) => isAnime(detail),
  };
