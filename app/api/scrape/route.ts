import {
  handleAnimeScrapeGet,
  handleScrapeGet,
  handleScrapePost,
} from "@/lib/scrape/api-handlers";

export const maxDuration = 180;

export const POST = handleScrapePost;
export const GET = handleScrapeGet;
