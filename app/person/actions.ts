"use server";

import { MediaItem } from "@/utils/typings";
import { buildItemsWithCategories, fetchPersonFilmography } from "../actions";

// Type guard to validate that raw TMDB data has required fields
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

export async function getMoreFilmographyForPerson(
  personId: number,
  page: number,
): Promise<readonly [MediaItem[], number | null]> {
  try {
    const response = await fetchPersonFilmography(personId, page);

    if (!response?.results) {
      return [[], null];
    }

    // Filter and validate the results to ensure they have required fields
    const validResults = response.results.filter(isValidMediaData);

    const filmographyWithCategories = await buildItemsWithCategories(
      validResults,
      "multi",
    );

    const nextOffset = page < (response.total_pages || 0) ? page + 1 : null;

    return [filmographyWithCategories, nextOffset] as const;
  } catch (error) {
    console.error("Error loading more filmography:", error);
    return [[], null];
  }
}
