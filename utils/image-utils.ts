/**
 * Utility functions for working with TMDB images
 */

export const IMAGE_BASE_URL = "https://image.tmdb.org/t/p";

export type TmdbImageSize =
  | "w92"
  | "w154"
  | "w185"
  | "w342"
  | "w500"
  | "w780"
  | "original";

/**
 * Creates a URL for a TMDB image
 * @param path The image path from TMDB API
 * @param size The desired size
 * @returns Full URL to the image
 */
export const getTmdbImageUrl = (
  path: string | null | undefined,
  size: TmdbImageSize = "original",
): string | null => {
  if (!path) return null;
  return `${IMAGE_BASE_URL}/${size}${path}`;
};
