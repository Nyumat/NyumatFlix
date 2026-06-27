import { MovieDb } from "moviedb-promise";

export const isBrowser = typeof window !== "undefined";

export const requiredEnvVars = [
  "TMDB_API_KEY",
  "AUTH_RESEND_KEY",
  "AUTH_SECRET",
  "AUTH_URL",
  "DATABASE_URL",
];
export const LOGGER_TITLE = "Nyumatflix 3.0";

export const SITE_URL = "https://nyumatflix.com";
export const UMAMI_URL = "https://analytics.nyumatflix.com";
export const UMAMI_WEBSITE_ID = "eb985e75-d6fe-42d3-8e24-0de58c4bf22c";
export const UMAMI_CLOUD_WEBSITE_ID = "679411bf-5cd3-4f57-983d-956d67f033cc";
export const SITE_NAME = "NyumatFlix";
export const DEFAULT_DESCRIPTION =
  "Nyumatflix is an open-source, no-cost, and ad-free movie and TV stream aggregator.";
export const SITE_TAGLINE = "Watch Movies and TV Shows";
export const SITE_HERO_BANNER_PATH = "/movie-banner.webp";
export const SITE_OG_HEADLINE = "Find where anything streams.";
// For development, you can set RESEND_FROM_EMAIL in .env.local
// The email domain must be verified in your Resend account
// Example: RESEND_FROM_EMAIL="Nyumatflix <noreply@yourdomain.com>"
export const MAGIC_LINK_RESEND_FROM =
  process.env.NODE_ENV === "production"
    ? "Nyumatflix <login@auth.nyumatflix.com>"
    : process.env.RESEND_FROM_EMAIL || "Nyumatflix <delivered@resend.dev>";
export const MAGIC_LINK_RESEND_SUBJECT = "Here's your magic link to sign in";
export const TMDB_BASE_URL = "https://api.themoviedb.org/3";

/** Series graph total nodes (seasons + episodes) above which mobile defaults to canvas */
export const LARGE_SERIES_GRAPH_NODE_THRESHOLD = 75;

/** matches Tailwind `lg` — series graph grid on desktop */
export const TV_DETAIL_LG_MEDIA_QUERY = "(min-width: 1024px)";

export const TMDB_WATCH_REGION = "US" as const;
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
