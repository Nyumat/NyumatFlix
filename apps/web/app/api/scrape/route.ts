import {
  handleAnimeScrapeGet,
  handleScrapeGet,
  handleScrapePost,
} from "@/lib/scrape/api-handlers";

export const maxDuration = 300;

export const POST = handleScrapePost;
export const GET = handleScrapeGet;
