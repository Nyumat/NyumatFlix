"use server";

import React from "react";
import {
  buildItemsWithCategories,
  fetchPaginatedCategory,
  fetchTMDBData,
} from "@/app/actions";
import { ContentGrid } from "@/components/content/media-content-grid";
import { MediaItem } from "@/utils/typings";

export async function getMoreMovies(
  endpoint: string,
  params: Record<string, string> | { useCustomFetch: boolean },
  offset: number,
): Promise<readonly [React.JSX.Element, number | null] | null> {
  let response: { results?: MediaItem[]; total_pages?: number } | null = null;

  if (typeof params === "object" && "useCustomFetch" in params) {
    const results = await fetchPaginatedCategory(endpoint, "movie", offset);
    response = { results, total_pages: undefined };
  } else {
    response = await fetchTMDBData(endpoint, {
      ...params,
      page: offset.toString(),
    });
  }

  if (!response?.results || response.results.length === 0) {
    return null;
  }

  const validResults = response.results.filter((item: MediaItem) =>
    Boolean(item.poster_path),
  );

  if (validResults.length === 0) {
    return null;
  }

  const processedMovies = await buildItemsWithCategories<MediaItem>(
    validResults,
    "movie",
  );

  const nextOffset =
    typeof response.total_pages === "number"
      ? offset < response.total_pages
        ? offset + 1
        : null
      : response.results.length > 0
        ? offset + 1
        : null;

  return [
    <ContentGrid
      items={processedMovies}
      key={offset}
      type="movie"
      showViewModeControls={false}
    />,
    nextOffset,
  ] as const;
}
