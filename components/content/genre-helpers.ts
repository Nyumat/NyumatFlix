/**
 * Genre mapping utility for TMDB genre IDs to human-readable names
 * Supports both movie and TV show genres from The Movie Database API
 */

/**
 * Movie genre mapping
 */
const MOVIE_GENRE_MAP: Record<number, string> = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Science Fiction",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
} as const;

/**
 * TV show genre mapping
 */
const TV_GENRE_MAP: Record<number, string> = {
  10759: "Action & Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  10762: "Kids",
  9648: "Mystery",
  10763: "News",
  10764: "Reality",
  10765: "Sci‑Fi & Fantasy",
  10766: "Soap",
  10767: "Talk",
  10768: "War & Politics",
  37: "Western",
} as const;

/**
 * Maps a genre ID to its corresponding human-readable name
 * @param genreId - The TMDB genre ID to look up
 * @param mediaType - The media type (movie or tv) to determine which mapping to use
 * @returns The genre name or "Unknown" if the ID is not found
 */
export function getGenreName(
  genreId?: number,
  mediaType: "movie" | "tv" = "movie",
): string {
  if (genreId === undefined || genreId === null) {
    return "N/A";
  }

  const genreMap = mediaType === "tv" ? TV_GENRE_MAP : MOVIE_GENRE_MAP;
  return genreMap[genreId] || "Unknown";
}

/**
 * Maps multiple genre IDs to their corresponding names
 * @param genreIds - Array of TMDB genre IDs
 * @param mediaType - The media type (movie or tv) to determine which mapping to use
 * @returns Array of genre names, filtering out unknown genres
 */
export function getGenreNames(
  genreIds?: number[],
  mediaType: "movie" | "tv" = "movie",
): string[] {
  if (!Array.isArray(genreIds)) {
    return [];
  }

  return genreIds
    .map((id) => getGenreName(id, mediaType))
    .filter((name) => name !== "Unknown" && name !== "N/A");
}

/**
 * Checks if a genre ID exists in the mapping
 * @param genreId - The genre ID to check
 * @param mediaType - The media type (movie or tv) to determine which mapping to use
 * @returns True if the genre ID is valid, false otherwise
 */
export function isValidGenreId(
  genreId: number,
  mediaType: "movie" | "tv" = "movie",
): boolean {
  const genreMap = mediaType === "tv" ? TV_GENRE_MAP : MOVIE_GENRE_MAP;
  return genreId in genreMap;
}

/**
 * Gets all available genre mappings for a specific media type
 * @param mediaType - The media type (movie or tv)
 * @returns Complete genre mapping object for the specified media type
 */
export function getAllGenres(
  mediaType: "movie" | "tv" = "movie",
): Record<number, string> {
  const genreMap = mediaType === "tv" ? TV_GENRE_MAP : MOVIE_GENRE_MAP;
  return { ...genreMap };
}
