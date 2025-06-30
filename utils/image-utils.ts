/**
 * Utility functions for working with TMDB images
 */

export const IMAGE_BASE_URL = "https://image.tmdb.org/t/p";

export type TmdbImageSize =
  | "original"
  | "w45"
  | "w92"
  | "w154"
  | "w185"
  | "w300"
  | "w342"
  | "w500"
  | "w780"
  | "w1280"
  | "h632";

export type TmdbImageType =
  | "poster"
  | "backdrop"
  | "still"
  | "profile"
  | "logo";

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

/**
 * A map of valid sizes for each image type
 */
export const VALID_SIZES: Record<TmdbImageType, TmdbImageSize[]> = {
  poster: ["w92", "w154", "w185", "w342", "w500", "w780", "original"],
  backdrop: ["w300", "w780", "w1280", "original"],
  still: ["w92", "w185", "w300", "original"],
  profile: ["w45", "w185", "h632", "original"],
  logo: ["w45", "w92", "w154", "w185", "w300", "w500", "original"],
};

/**
 * Validates if the specified size is valid for the image type
 */
export const isValidSize = (
  type: TmdbImageType,
  size: TmdbImageSize,
): boolean => {
  return VALID_SIZES[type].includes(size);
};
