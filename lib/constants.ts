import { MovieDb } from "moviedb-promise";

export const isBrowser = typeof window !== "undefined";

export const requiredEnvVars = [
  "TMDB_API_KEY",
  "AUTH_RESEND_KEY",
  "AUTH_SECRET",
  "AUTH_URL",
  "DATABASE_URL",
  "PROD_DATABASE_URL",
];
export const LOGGER_TITLE = "Nyumatflix 3.0";
// For development, you can set RESEND_FROM_EMAIL in .env.local
// The email domain must be verified in your Resend account
// Example: RESEND_FROM_EMAIL="Nyumatflix <noreply@yourdomain.com>"
export const MAGIC_LINK_RESEND_FROM =
  process.env.NODE_ENV === "production"
    ? "Nyumatflix <login@auth.nyumatflix.com>"
    : process.env.RESEND_FROM_EMAIL || "Nyumatflix <delivered@resend.dev>";
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
