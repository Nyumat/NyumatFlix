import {
  TMDB_SCRAPE_PROVIDER_LABELS,
  TMDB_SCRAPE_PROVIDER_OPTIONS,
  TMDB_SCRAPE_PROVIDER_ORDER,
  type TmdbScrapeProviderId,
} from "@/lib/providers/registry";

export type ScrapeMediaType = "movie" | "tv";

export type ScrapeMediaInput = {
  mediaType: ScrapeMediaType;
  tmdbId: number;
  seasonNumber?: number;
  episodeNumber?: number;
};

export const scrapeMediaKeyFor = (input: ScrapeMediaInput): string =>
  [
    input.mediaType,
    input.tmdbId,
    input.seasonNumber ?? "",
    input.episodeNumber ?? "",
  ].join(":");

export type ScrapeSubtitle = {
  lang: string;
  url: string;
  format?: "ass" | "srt" | "vtt";
};

export type ScrapeQuality = {
  label: string;
  url: string;
  subtitles?: ScrapeSubtitle[];
  referer?: string;
};

export type ScrapeHardSub = {
  lang: string;
  label: string;
  url: string;
};

export type ScrapeAudioVersion = {
  lang: string;
  label: string;
  url: string;
  original?: boolean;
  hardSubs?: ScrapeHardSub[];
  subtitles?: ScrapeSubtitle[];
};

export type ScrapeSuccess = {
  ok: true;
  providerId: string;
  validated?: true;
  streamUrl: string;
  referer?: string;
  subtitles?: ScrapeSubtitle[];
  qualities?: ScrapeQuality[];
  audioVersions?: ScrapeAudioVersion[];
  defaultAudioLang?: string;
  defaultHardSubLang?: string;
  preferredAudioLang?: string;
};

export type ScrapeFailure = {
  ok: false;
  providerId: string;
  error: string;
};

export type ScrapeResult = ScrapeSuccess | ScrapeFailure;

export type ScrapeItemStatus =
  | "waiting"
  | "pending"
  | "success"
  | "failure"
  | "skipped";

export type ScrapeItem = {
  providerId: string;
  name: string;
  status: ScrapeItemStatus;
  error?: string;
};

/** Direct HLS scrape chain (tried in order). */
export const SCRAPE_PROVIDER_ORDER = TMDB_SCRAPE_PROVIDER_ORDER;

/** Alias for SCRAPE_PROVIDER_ORDER (kept for API route imports). */
export const ALL_SCRAPE_PROVIDER_IDS = SCRAPE_PROVIDER_ORDER;

export type ScrapeProviderId = TmdbScrapeProviderId;

export const SCRAPE_PROVIDER_LABELS = TMDB_SCRAPE_PROVIDER_LABELS;

export const SCRAPE_PROVIDER_OPTIONS = TMDB_SCRAPE_PROVIDER_OPTIONS;
