import type {
  ScrapeAudioVersion,
  ScrapeMediaInput,
  ScrapeQuality,
  ScrapeSubtitle,
} from "../types";
import type { ScrapePlaybackRefresh } from "../playback-refresh";
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
  /**
   * TMDB season/episode coords for softsub fallback (sub.1x2.space) when the
   * stream provider omits caption tracks. Season/episode here are TMDB-relative
   * and may differ from AniList `episodeNumber`.
   */
  tmdb?: Pick<
    ScrapeMediaInput,
    "mediaType" | "tmdbId" | "seasonNumber" | "episodeNumber"
  >;
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
  /** Provider already ran full stream + play-path probes — skip outer re-validation. */
  validated?: true;
  streamUrl: string;
  streamKind: StreamKind;
  referer?: string;
  playbackRefresh?: ScrapePlaybackRefresh;
  cookies?: string;
  subtitles?: ScrapeSubtitle[];
  qualities?: ScrapeQuality[];
  audioVersions?: ScrapeAudioVersion[];
  defaultAudioLang?: string;
  defaultHardSubLang?: string;
  preferredAudioLang?: string;
  fallbackFrom?: {
    providerId: AnimeScrapeProviderId;
    error: string;
  };
};

export type AnimeScrapeFailure = {
  ok: false;
  providerId: AnimeScrapeProviderId;
  error: string;
  /** Title is not in this provider's catalog (not a transient scrape error). */
  unavailable?: boolean;
};

export type AnimeScrapeResult = AnimeScrapeSuccess | AnimeScrapeFailure;
