import { MovieDb } from "moviedb-promise";

export const isBrowser = typeof window !== "undefined";

export const requiredEnvVars = [
  "TMDB_API_KEY",
  "AUTH_RESEND_KEY",
  "AUTH_URL",
  "DATABASE_URL",
  "PROD_DATABASE_URL",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
];
export const LOGGER_TITLE = "Nyumatflix 3.0";
export const MAGIC_LINK_RESEND_FROM = "Nyumatflix <login@auth.nyumatflix.com>";
export const MAGIC_LINK_RESEND_SUBJECT =
  "nyumatflix.com - Here's your magic link to sign in";
export const TMDB_BASE_URL = "https://api.themoviedb.org/3";
let TMDB_API_KEY: string | undefined;
if (!isBrowser) {
  TMDB_API_KEY = process.env.TMDB_API_KEY;
  if (!TMDB_API_KEY) {
    console.error(
      "❌ Server Error: TMDB_API_KEY is missing in environment variables",
    );
    if (process.env.NODE_ENV === "development") {
      throw new Error(
        "TMDB API key is missing - please add it to .env.local file",
      );
    }
  }
} else {
  TMDB_API_KEY = undefined;
}
export { TMDB_API_KEY };
export const movieDb =
  !isBrowser && TMDB_API_KEY
    ? new MovieDb(TMDB_API_KEY)
    : (null as unknown as MovieDb);
