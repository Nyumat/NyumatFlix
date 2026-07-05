import type { ScrapeQuality, ScrapeSubtitle } from "../types";
import type { StreamKind } from "../stream-url-patterns";
import {
  ANIME_SCRAPE_PROVIDER_LABELS,
  ANIME_SCRAPE_PROVIDER_OPTIONS,
  ANIME_SCRAPE_PROVIDER_ORDER,
  type AnimeScrapeProviderId,
} from "@/lib/providers/registry";

export type AnimeTranslationType = "sub" | "dub";

export type AnimeScrapeInput = {
  anilistId: number;
  episodeNumber: number;
  translationType?: AnimeTranslationType;
  /** Override search query (defaults to AniList romaji/english title). */
  query?: string;
};

export const animeScrapeMediaKeyFor = (input: AnimeScrapeInput): string =>
  [input.anilistId, input.episodeNumber, input.translationType ?? "sub"].join(
    ":",
  );

export type AnimeScrapeSubtitle = ScrapeSubtitle;
export type AnimeScrapeQuality = ScrapeQuality;

export {
  ANIME_SCRAPE_PROVIDER_LABELS,
  ANIME_SCRAPE_PROVIDER_OPTIONS,
  ANIME_SCRAPE_PROVIDER_ORDER,
  type AnimeScrapeProviderId,
};

export type AnimeScrapeSuccess = {
  ok: true;
  providerId: AnimeScrapeProviderId;
  streamUrl: string;
  streamKind: StreamKind;
  referer?: string;
  subtitles?: ScrapeSubtitle[];
  qualities?: ScrapeQuality[];
};

export type AnimeScrapeFailure = {
  ok: false;
  providerId: AnimeScrapeProviderId;
  error: string;
};

export type AnimeScrapeResult = AnimeScrapeSuccess | AnimeScrapeFailure;
