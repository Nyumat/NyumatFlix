"use client";

import { useMemo } from "react";

import { useFeatureFlagsOptional } from "@/components/providers/feature-flags-provider";
import { filterAnimeScrapeProviderIds } from "@/lib/flags/site-flags";
import { useProviderScrapeLoop } from "@/hooks/use-provider-scrape-loop";
import {
  ANIME_SCRAPE_PROVIDER_LABELS,
  ANIME_SCRAPE_PROVIDER_ORDER,
  animeScrapeMediaKeyFor,
  type AnimeScrapeInput,
  type AnimeScrapeProviderId,
} from "@/lib/scrape/anime/types";
import type {
  ScrapeAudioVersion,
  ScrapeQuality,
  ScrapeSubtitle,
} from "@/lib/scrape/types";

export type AnimeScrapeSuccessPayload = {
  providerId: AnimeScrapeProviderId;
  providerName: string;
  playUrl: string;
  streamKind: "hls" | "dash" | "mp4";
  referer?: string;
  qualities?: ScrapeQuality[];
  subtitles?: ScrapeSubtitle[];
  audioVersions?: ScrapeAudioVersion[];
  defaultAudioLang?: string;
  defaultHardSubLang?: string;
  preferredAudioLang?: string;
};

const animeScrapeLoopConfig = {
  providerOrder: ANIME_SCRAPE_PROVIDER_ORDER,
  providerLabels: ANIME_SCRAPE_PROVIDER_LABELS,
  mediaKeyFor: animeScrapeMediaKeyFor,
  allFailedError: "No playable source found.",
  apiPath: "/api/scrape",
  buildRequestBody: (
    providerId: AnimeScrapeProviderId,
    input: AnimeScrapeInput,
  ) => ({
    mediaKind: "anime",
    providerId,
    anilistId: input.anilistId,
    episodeNumber: input.episodeNumber,
    translationType: input.translationType,
    query: input.query,
  }),
} as const;

export function useAnimeScrape() {
  const flags = useFeatureFlagsOptional();
  const config = useMemo(
    () => ({
      ...animeScrapeLoopConfig,
      providerOrder: flags
        ? (filterAnimeScrapeProviderIds(
            flags,
            ANIME_SCRAPE_PROVIDER_ORDER,
          ) as typeof ANIME_SCRAPE_PROVIDER_ORDER)
        : ANIME_SCRAPE_PROVIDER_ORDER,
    }),
    [flags],
  );

  return useProviderScrapeLoop<
    AnimeScrapeProviderId,
    AnimeScrapeInput,
    AnimeScrapeSuccessPayload
  >(config);
}

export type UseAnimeScrapeReturn = ReturnType<typeof useAnimeScrape>;
