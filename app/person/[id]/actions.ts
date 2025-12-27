"use server";

import {
  buildItemsWithCategories,
  fetchPersonFilmography,
} from "@/app/actions";
import { MediaItem } from "@/utils/typings";

function isValidMediaData(
  item: unknown,
): item is { id: number; genre_ids?: number[] } {
  return (
    typeof item === "object" &&
    item !== null &&
    "id" in item &&
    typeof (item as { id: unknown }).id === "number"
  );
}

export async function getFilmographyListNodes(
  personId: number,
  offset: number,
  seenIds?: number[],
): Promise<{ items: MediaItem[]; nextOffset: number | null } | null> {
  try {
    const seenIdsSet = new Set(seenIds || []);
    const response = await fetchPersonFilmography(personId, offset);

    if (!response?.results) {
      return null;
    }

    const validResults = response.results.filter(
      (
        item,
      ): item is {
        id: number;
        genre_ids?: number[];
        poster_path?: string | null;
      } =>
        isValidMediaData(item) &&
        Boolean((item as { poster_path?: string | null }).poster_path),
    );

    if (validResults.length === 0) {
      return null;
    }

    const processedFilmography = await buildItemsWithCategories(
      validResults,
      "multi",
    );

    const uniqueFilmography = processedFilmography.filter((item) => {
      if (typeof item.id !== "number") return true;
      if (seenIdsSet.has(item.id)) return false;
      return true;
    });

    if (uniqueFilmography.length === 0) {
      const nextOffset =
        offset < (response.total_pages || 0) ? offset + 1 : null;
      if (nextOffset && offset < 100) {
        return getFilmographyListNodes(personId, nextOffset, seenIds);
      }
      return null;
    }

    const nextOffset = offset < (response.total_pages || 0) ? offset + 1 : null;

    return {
      items: uniqueFilmography,
      nextOffset,
    };
  } catch (error) {
    console.error("Error loading more filmography:", error);
    return null;
  }
}
