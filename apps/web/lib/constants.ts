import { MovieDb } from "moviedb-promise";
import { cdnUrl } from "@/lib/cdn";

export const isBrowser = typeof window !== "undefined";

export const requiredEnvVars = [
  "TMDB_API_KEY",
  "AUTH_RESEND_KEY",
  "AUTH_SECRET",
  "AUTH_URL",
  "DATABASE_URL",
];
export const LOGGER_TITLE = "[Nyumatflix]";

export const SITE_URL = "https://nyumatflix.com";
export const UMAMI_URL = "https://analytics.nyumatflix.com";
export const UMAMI_WEBSITE_ID = "eb985e75-d6fe-42d3-8e24-0de58c4bf22c";
export const UMAMI_CLOUD_WEBSITE_ID = "679411bf-5cd3-4f57-983d-956d67f033cc";
export const SITE_NAME = "NyumatFlix";
export const DEFAULT_DESCRIPTION =
  "Nyumatflix is an open-source, no-cost, and ad-free movie and TV stream aggregator.";
export const SITE_TAGLINE = "Watch Movies and TV Shows";
export const SITE_HERO_BANNER_PATH = "/movie-banner.webp";
export const SITE_HERO_BANNER_URL = cdnUrl(SITE_HERO_BANNER_PATH);
export const SITE_OG_HEADLINE = "Find where anything streams.";
/**
 * AnimeOnsen (and ani.pm) serve MPEG-DASH. Vidstack+dashjs gives the full
 * player UI (Shaka fell back to bare native <video> controls); flip to true
 * only if dashjs proves unreliable for MPD again.
 */
export const USE_SHAKA_DASH = false;
export const MAGIC_LINK_RESEND_FROM =
  process.env.RESEND_FROM_EMAIL ||
  (process.env.NODE_ENV === "production"
    ? "NyumatFlix <hello@nyumatflix.com>"
    : "NyumatFlix <delivered@resend.dev>");
export const MAGIC_LINK_RESEND_SUBJECT = "Sign in to NyumatFlix";
export const TMDB_BASE_URL = "https://api.themoviedb.org/3";

export const LARGE_SERIES_GRAPH_NODE_THRESHOLD = 75;

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
