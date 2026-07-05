"use client";

import { useMemo } from "react";

import { useProviderScrapeLoop } from "@/hooks/use-provider-scrape-loop";
import {
  ANIME_SCRAPE_PROVIDER_LABELS,
  ANIME_SCRAPE_PROVIDER_ORDER,
  animeScrapeMediaKeyFor,
  type AnimeScrapeInput,
  type AnimeScrapeProviderId,
} from "@/lib/scrape/anime/types";
import type { ScrapeQuality, ScrapeSubtitle } from "@/lib/scrape/types";

export type AnimeScrapePlayerStatus = "idle" | "scraping" | "playing" | "error";

export type AnimeScrapeSuccessPayload = {
  providerId: AnimeScrapeProviderId;
  providerName: string;
  playUrl: string;
  streamKind: "hls" | "dash" | "mp4";
  referer?: string;
  qualities?: ScrapeQuality[];
  subtitles?: ScrapeSubtitle[];
};

const animeScrapeLoopConfig = {
  providerOrder: ANIME_SCRAPE_PROVIDER_ORDER,
  providerLabels: ANIME_SCRAPE_PROVIDER_LABELS,
  mediaKeyFor: animeScrapeMediaKeyFor,
  allFailedError: "All anime sources failed. Try another server or retry.",
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
  return useProviderScrapeLoop<
    AnimeScrapeProviderId,
    AnimeScrapeInput,
    AnimeScrapeSuccessPayload
  >(useMemo(() => animeScrapeLoopConfig, []));
}

export type UseAnimeScrapeReturn = ReturnType<typeof useAnimeScrape>;
