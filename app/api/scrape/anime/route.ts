import {
  handleAnimeScrapeGet,
  handleScrapePost,
} from "@/lib/scrape/api-handlers";

export const maxDuration = 180;

/** @deprecated Prefer POST /api/scrape with `mediaKind: "anime"`. */
export const POST = handleScrapePost;
export const GET = handleAnimeScrapeGet;
