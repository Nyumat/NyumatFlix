"use client";

import { useMemo } from "react";

import { useProviderScrapeLoop } from "@/hooks/use-provider-scrape-loop";
import {
  SCRAPE_PROVIDER_LABELS,
  SCRAPE_PROVIDER_ORDER,
  scrapeMediaKeyFor,
  type ScrapeAudioVersion,
  type ScrapeMediaInput,
  type ScrapeProviderId,
  type ScrapeQuality,
  type ScrapeSubtitle,
} from "@/lib/scrape/types";

export type ScrapePlayerStatus = "idle" | "scraping" | "playing" | "error";

export type ScrapeSuccessPayload = {
  providerId: ScrapeProviderId;
  providerName: string;
  playUrl: string;
  streamKind?: "hls" | "dash" | "mp4";
  referer?: string;
  qualities?: ScrapeQuality[];
  subtitles?: ScrapeSubtitle[];
  audioVersions?: ScrapeAudioVersion[];
  defaultAudioLang?: string;
  defaultHardSubLang?: string;
  preferredAudioLang?: string;
};

const scrapeLoopConfig = {
  providerOrder: SCRAPE_PROVIDER_ORDER,
  providerLabels: SCRAPE_PROVIDER_LABELS,
  mediaKeyFor: scrapeMediaKeyFor,
  allFailedError: "All sources failed. Try another server or retry.",
  apiPath: "/api/scrape",
  buildRequestBody: (
    providerId: ScrapeProviderId,
    input: ScrapeMediaInput,
  ) => ({
    mediaKind: "tmdb",
    providerId,
    mediaType: input.mediaType,
    tmdbId: input.tmdbId,
    seasonNumber: input.seasonNumber,
    episodeNumber: input.episodeNumber,
  }),
} as const;

export function useScrape() {
  return useProviderScrapeLoop<
    ScrapeProviderId,
    ScrapeMediaInput,
    ScrapeSuccessPayload
  >(useMemo(() => scrapeLoopConfig, []));
}

export type UseScrapeReturn = ReturnType<typeof useScrape>;
