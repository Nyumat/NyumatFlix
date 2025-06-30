import { MovieDb } from "moviedb-promise";

export const TMDB_BASE_URL = "https://api.themoviedb.org/3";

// Only check for API key on the server
let TMDB_API_KEY: string | undefined;

// Check for browser environment to avoid throwing in client components
if (typeof window === "undefined") {
  // Running on server
  TMDB_API_KEY = process.env.TMDB_API_KEY;

  // Only throw on server if key is missing
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
  // Running in browser - API calls should go through Next.js API routes
  TMDB_API_KEY = undefined;
}

// Re-export for server-side use
export { TMDB_API_KEY };

// Only create MovieDb instance on server
export const movieDb =
  typeof window === "undefined" && TMDB_API_KEY
    ? new MovieDb(TMDB_API_KEY)
    : (null as unknown as MovieDb); // Type assertion for client-side
