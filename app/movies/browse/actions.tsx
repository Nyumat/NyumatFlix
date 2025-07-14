"use server";

import { buildItemsWithCategories, fetchTMDBData } from "@/app/actions";
import { ContentGrid } from "@/components/content/media-content-grid";
import { MediaItem } from "@/utils/typings";
import React from "react";

export async function getMoreMovies(
  endpoint: string,
  params: Record<string, string>,
  offset: number,
): Promise<readonly [React.JSX.Element, number | null] | null> {
  try {
    const response = await fetchTMDBData(endpoint, {
      ...params,
      page: offset.toString(),
    });

    if (!response?.results || response.results.length === 0) {
      return null;
    }

    const processedMovies = await buildItemsWithCategories<MediaItem>(
      response.results,
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
