"use server";

import { MediaItem } from "@/utils/typings";
import { buildItemsWithCategories, fetchTMDBData } from "../actions";

export async function getMoreMoviesForRow(
  endpoint: string,
  page: number,
  withGenre?: number,
): Promise<readonly [MediaItem[], number | null]> {
  try {
    const baseUrl = `${endpoint}?page=${page}`;
    const url = withGenre ? `${baseUrl}&with_genres=${withGenre}` : baseUrl;
    const response = await fetchTMDBData(url);

    if (!response?.results) {
      return [[], null];
    }

    const moviesWithCategories = await buildItemsWithCategories<MediaItem>(
      response.results,
      "movie",
    );

    const nextOffset = page < (response.total_pages || 0) ? page + 1 : null;

    return [moviesWithCategories, nextOffset] as const;
  } catch (error) {
    console.error("Error loading more movies:", error);
    return [[], null];
  }
}
