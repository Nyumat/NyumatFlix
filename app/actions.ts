import { TmdbResponse } from "@/utils/typings";

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

interface TMDBResponse<T> {
  results: T[];
}

const TMDB_BASE_URL = "https://api.themoviedb.org/3";

export async function getCategoriesForMovie(): Promise<Genre[]> {
  const genres = await fetch(
    `https://api.themoviedb.org/3/genre/movie/list?api_key=${process.env.TMDB_API_KEY}`,
  ).then((res) => res.json());
  return genres.genres;
}

export const buildMoviesWithCategories = async (movies: Movie[]) => {
  const categories = await getCategoriesForMovie();
  return movies.map((movie) => {
    const movieCategories = categories
      .filter((category) => movie.genre_ids.includes(category.id))
      .map((category) => category.name);
    return { ...movie, categories: movieCategories };
  });
};

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
  items: any[],
  type: "movie" | "tv" | "multi",
) {
  const movieCategories = await getCategories("movie");
  const tvCategories = await getCategories("tv");

  return items.map((item) => {
    const itemCategories =
      type === "movie" || (type === "multi" && item.media_type === "movie")
        ? movieCategories
        : tvCategories;

    const categories = itemCategories
      .filter((category: Genre) => item.genre_ids.includes(category.id))
      .map((category: Genre) => category.name);

    return { ...item, categories };
  });
}

export async function getCategories(type: "movie" | "tv"): Promise<Genre[]> {
  const genres = await fetchTMDBData(`/genre/${type}/list`);
  return genres.genres;
}

export async function fetchTMDBData(
  endpoint: string,
  params: Params = {},
  page: number = 1,
): Promise<any> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    throw new Error("TMDB API key is missing");
  }

  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
  url.searchParams.append("api_key", apiKey);
  url.searchParams.append("page", page.toString());

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.append(key, value);
  }

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(
      `TMDB API error: ${response.status} ${response.statusText}`,
    );
  }
  return response.json();
}
