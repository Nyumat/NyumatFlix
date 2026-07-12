"use client";

import { useMemo } from "react";

import { useFeatureFlagsOptional } from "@/components/providers/feature-flags-provider";
import { filterTmdbScrapeProviderIds } from "@/lib/flags/site-flags";
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
  allFailedError: "No playable source found.",
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
  const flags = useFeatureFlagsOptional();
  const config = useMemo(
    () => ({
      ...scrapeLoopConfig,
      providerOrder: flags
        ? (filterTmdbScrapeProviderIds(
            flags,
            SCRAPE_PROVIDER_ORDER,
          ) as typeof SCRAPE_PROVIDER_ORDER)
        : SCRAPE_PROVIDER_ORDER,
    }),
    [flags],
  );

  return useProviderScrapeLoop<
    ScrapeProviderId,
    ScrapeMediaInput,
    ScrapeSuccessPayload
  >(config);
}

export type UseScrapeReturn = ReturnType<typeof useScrape>;
