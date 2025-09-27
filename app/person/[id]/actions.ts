"use server";

import {
  buildItemsWithCategories,
  fetchPersonFilmography,
} from "@/app/actions";

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
) {
  try {
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

    const nextOffset = offset < (response.total_pages || 0) ? offset + 1 : null;

    return {
      items: processedFilmography,
      nextOffset,
    };
  } catch (error) {
    console.error("Error loading more filmography:", error);
    return null;
  }
}
