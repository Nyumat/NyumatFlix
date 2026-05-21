"use server";

import type { AniListSearchParams } from "@/lib/anilist";
import type { MediaItem } from "@/lib/domain/typings";
import { fetchAnimeNextPage as fetchAnimeNextPageImpl } from "@/lib/server/fetch-anime-next-page";

export async function fetchAnimeNextPage(
  params: AniListSearchParams,
  page: number,
): Promise<{
  results: MediaItem[];
  page: number;
  hasNextPage: boolean;
}> {
  return fetchAnimeNextPageImpl(params, page);
}
