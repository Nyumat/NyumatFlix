import { MovieDb } from "moviedb-promise";

export const TMDB_BASE_URL = "https://api.themoviedb.org/3";
export const TMDB_API_KEY =
  process.env.TMDB_API_KEY ?? process.env.NEXT_PUBLIC_TMDB_API_KEY;
if (!TMDB_API_KEY) {
  throw new Error("TMDB API key is missing");
}
export const movieDb = new MovieDb(TMDB_API_KEY!);
