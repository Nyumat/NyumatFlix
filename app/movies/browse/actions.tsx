"use server";

import {
  buildItemsWithCategories,
  fetchPaginatedCategory,
  fetchTMDBData,
} from "@/app/actions";
import { ContentGrid } from "@/components/content/media-content-grid";
import { MediaItem } from "@/utils/typings";
import React from "react";

export async function getMoreMovies(
  endpoint: string,
  params: Record<string, string> | { useCustomFetch: boolean },
  offset: number,
): Promise<readonly [React.JSX.Element, number | null] | null> {
  try {
    let response;

    // Check if this is a custom fetch filter (like director filters)
    if (typeof params === "object" && "useCustomFetch" in params) {
      // This is a custom fetch filter, use fetchPaginatedCategory
      const results = await fetchPaginatedCategory(endpoint, "movie", offset);
      response = { results, total_pages: 10 }; // Default total_pages for custom fetch
    } else {
      // This is a regular filter, use fetchTMDBData
      response = await fetchTMDBData(endpoint, {
        ...params,
        page: offset.toString(),
      });
    }

    if (!response?.results || response.results.length === 0) {
      return null;
    }

    // Filter out items without poster_path to match initial load behavior
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

    const nextOffset = offset < (response.total_pages || 0) ? offset + 1 : null;

    return [
      <ContentGrid items={processedMovies} key={offset} type="movie" />,
      nextOffset,
    ] as const;
  } catch (error) {
    console.error("Error loading more movies:", error);
    return null;
  }
}
