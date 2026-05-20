"use server";

import { fetchAniListPage, type AniListSearchParams } from "@/lib/anilist";
import { enrichAniListMediaItemsWithTmdb } from "@/lib/anilist-tmdb";
import type { MediaItem } from "@/utils/typings";

const ANIME_RESULTS_PER_PAGE = 30;
const ANIME_RESULTS_MAX_LOOKUPS = 12;

const isInternalDetailItem = (item: MediaItem) =>
  !(
    "href" in item &&
    typeof item.href === "string" &&
    !item.href.startsWith("/")
  );

const withAnimePageHref = (item: MediaItem): MediaItem =>
  isInternalDetailItem(item)
    ? item
    : ({ ...item, href: "/tvshows" } as MediaItem);

export const fetchAnimeNextPage = async (
  params: AniListSearchParams,
  page: number,
): Promise<{
  results: MediaItem[];
  page: number;
  hasNextPage: boolean;
}> => {
  const data = await fetchAniListPage({
    page,
    perPage: ANIME_RESULTS_PER_PAGE,
    params,
  });
  const results = (
    await enrichAniListMediaItemsWithTmdb(data.media, ANIME_RESULTS_MAX_LOOKUPS)
  ).map(withAnimePageHref);

  return {
    results,
    page: data.pageInfo.currentPage,
    hasNextPage: data.pageInfo.hasNextPage,
  };
};
