"use client";

import { useCallback, useMemo } from "react";

import { useFeatureFlags } from "@/components/providers/feature-flags-provider";
import {
  filterTmdbScrapeProviderIds,
  getTmdbScrapeProviderMenuOrder,
} from "@/lib/flags/site-flags";
import { useProviderScrapeLoop } from "@/hooks/use-provider-scrape-loop";
import { TMDB_SCRAPE_SOLO_FIRST_PROVIDERS } from "@/lib/scrape/provider-race";
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
  directPlayback?: "hls" | "direct" | "extended";
  directFallbackUrl?: string;
  directStreamName?: string;
  directFileName?: string;
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
  soloFirstProviders: TMDB_SCRAPE_SOLO_FIRST_PROVIDERS,
  raceFirstWin: true,
} as const;

type UseScrapeOptions = {
  onAllProvidersFailed?: () => void;
};

export function useScrape(options?: UseScrapeOptions) {
  const flags = useFeatureFlags();
  const onAllProvidersFailed = options?.onAllProvidersFailed;
  const config = useMemo(
    () => ({
      ...scrapeLoopConfig,
      providerOrder: filterTmdbScrapeProviderIds(
        flags,
        getTmdbScrapeProviderMenuOrder(flags),
      ) as typeof SCRAPE_PROVIDER_ORDER,
      onAllProvidersFailed,
    }),
    [flags, onAllProvidersFailed],
  );

  return useProviderScrapeLoop<
    ScrapeProviderId,
    ScrapeMediaInput,
    ScrapeSuccessPayload
  >(config);
}

export type UseScrapeReturn = ReturnType<typeof useScrape>;
