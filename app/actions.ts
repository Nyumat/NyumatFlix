import { MediaItem, TmdbResponse } from "@/utils/typings";
import { MovieDb } from "moviedb-promise";

interface Params {
  [key: string]: string;
}

interface Genre {
  id: number;
  name: string;
}

export interface Movie {
  adult: boolean;
  backdrop_path: string;
  genre_ids: number[];
  id: number;
  original_language: string;
  original_title: string;
  overview: string;
  popularity: number;
  poster_path: string;
  release_date: string;
  title: string;
  video: boolean;
  vote_average: number;
  vote_count: number;
  categories?: string[]; // Optional field for the genre names
}

interface TVShow {
  id: number;
  name: string;
  genre_ids: number[];
  poster_path: string;
  categories?: string[];
}

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_API_KEY = process.env.TMDB_API_KEY;
export const movieDb = new MovieDb(TMDB_API_KEY ?? "");

export async function buildMaybeItemsWithCategories(
  items: (Movie | TVShow)[],
  type: "movie" | "tv" | "multi",
) {
  if (items.length === 0) {
    return [];
  }
  return buildItemsWithCategories(items, type);
}

export async function getCategories(
  type: "movie" | "tv" | "multi",
): Promise<Genre[]> {
  const genres = await fetchTMDBData(`/genre/${type}/list`);
  return genres.genres;
}

export const fetchAllData = async () => {
  const [popularMovies, topRatedMovies, popularTVShows, topRatedTVShows] =
    await Promise.all([
      fetchTMDBData("/movie/popular"),
      fetchTMDBData("/movie/top_rated"),
      fetchTMDBData("/tv/popular"),
      fetchTMDBData("/tv/top_rated"),
    ]);

  return {
    popularMovies: popularMovies.results,
    topRatedMovies: topRatedMovies.results,
    popularTVShows: popularTVShows.results,
    topRatedTVShows: topRatedTVShows.results,
  };
};

export async function buildItemsWithCategories(
  items: (Movie | TVShow)[],
  type: "movie" | "tv" | "multi",
) {
  const genres = await getCategories(type);

  const data = items.map((item) => {
    const itemGenres = genres.filter((genre) =>
      item.genre_ids.includes(genre.id),
    );
    const categories = itemGenres.map((genre) => genre.name);
    return { ...item, categories };
  });

  return data.map((item) => {
    if ((item as Movie).title !== undefined) {
      return item as Movie;
    } else {
      return item as TVShow;
    }
  }) as MediaItem[];
}

export async function fetchTMDBData(
  endpoint: string,
  params: Params = {},
  page: number = 1,
): Promise<TmdbResponse<MediaItem>> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    throw new Error("TMDB API key is missing");
  }

  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
  url.searchParams.append("append_to_response", "videos");
  url.searchParams.append("api_key", apiKey);
  url.searchParams.append("page", page.toString());

  // Add &append_to_response=videos

  for (const [key, value] of Object.entries(params)) {
    if (typeof key === "string" && typeof value === "string") {
      url.searchParams.append(key, value);
    }
  }

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(
      `TMDB API error: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();
  return data as TmdbResponse<MediaItem>;
}

export async function getNumberOfEpisodes(
  tvShowId: number,
): Promise<number | null> {
  const data = await fetchTMDBData(`/tv/${tvShowId}`, {}, 1);
  return data.number_of_episodes;
}

export async function getNumberOfSeasons(
  tvShowId: number,
): Promise<number | null> {
  const data = await fetchTMDBData(`/tv/${tvShowId}`, {}, 1);
  return data.number_of_seasons;
}

/**
 * Determines if a TMDB ID belongs to a movie or TV show.
 * @param {string|number} id - The TMDB ID to check.
 * @returns {Promise<string>} - Returns 'movie', 'tv', or 'unknown'.
 */
export async function determineMediaType(id: string | number) {
  try {
    // First, try to fetch as a movie
    const movieResponse = await fetch(
      `${TMDB_BASE_URL}/movie/${id}?api_key=${TMDB_API_KEY}`,
    );
    if (movieResponse.ok) {
      return "movie";
    }

    // If not a movie, try to fetch as a TV show
    const tvResponse = await fetch(
      `${TMDB_BASE_URL}/tv/${id}?api_key=${TMDB_API_KEY}`,
    );
    if (tvResponse.ok) {
      return "tv";
    }

    // If neither worked, return unknown
    return "unknown";
  } catch (error) {
    console.error("Error determining media type:", error);
    return "unknown";
  }
}

/**
 * Fetches details for a given TMDB ID, determining its type first.
 * @param {string|number} id - The TMDB ID to fetch details for.
 * @returns {Promise<Object>} - Returns the media details or null if not found.
 */
export async function fetchMediaDetails(id: string | number) {
  const mediaType = await determineMediaType(id);

  if (mediaType === "unknown") {
    return null;
  }

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/${mediaType}/${id}?api_key=${TMDB_API_KEY}`,
    );
    if (response.ok) {
      const data = await response.json();
      return { ...data, mediaType };
    }
    return null;
  } catch (error) {
    console.error("Error fetching media details:", error);
    return null;
  }
}

export async function test() {
  return await movieDb.genreMovieList();
}

export type MovieCategory =
  | "popular"
  | "top-rated"
  | "now-playing"
  | "upcoming";

export async function getMovies(type: MovieCategory, page: number) {
  switch (type) {
    case "popular":
      return await movieDb.moviePopular({ language: "en-US", page });
    case "top-rated":
      return await movieDb.movieTopRated({ language: "en-US", page });
    case "now-playing":
      return await movieDb.movieNowPlaying({ language: "en-US", page });
    case "upcoming":
      return await movieDb.upcomingMovies({ language: "en-US", page });
    default:
      return await movieDb.moviePopular({ language: "en-US", page });
  }
}
