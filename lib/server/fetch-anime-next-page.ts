import "server-only";

import { fetchAniListPage, type AniListSearchParams } from "@/lib/anilist";
import { enrichAniListMediaItemsLightweight } from "@/lib/anilist-tmdb";
import type { MediaItem } from "@/lib/domain/typings";

const ANIME_RESULTS_PER_PAGE = 30;
const ANIME_RESULTS_MAX_LOOKUPS = 30;

export async function fetchAnimeNextPage(
  params: AniListSearchParams,
  page: number,
): Promise<{
  results: MediaItem[];
  page: number;
  hasNextPage: boolean;
}> {
  const data = await fetchAniListPage({
    page,
    perPage: ANIME_RESULTS_PER_PAGE,
    params,
  });
  const results = await enrichAniListMediaItemsLightweight(
    data.media,
    ANIME_RESULTS_MAX_LOOKUPS,
  );

  return {
    results,
    page: data.pageInfo.currentPage,
    hasNextPage: data.pageInfo.hasNextPage,
  };
}
