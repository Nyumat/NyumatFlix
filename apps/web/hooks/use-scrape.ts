"use client";

import { useCallback, useMemo } from "react";

import { useFeatureFlags } from "@/components/providers/feature-flags-provider";
import { usePlaybackResolve } from "@/hooks/use-playback-resolve";
import {
  filterTmdbScrapeProviderIds,
  getTmdbScrapeProviderMenuOrder,
} from "@/lib/flags/site-flags";
import { TMDB_SCRAPE_PROVIDER_LABELS } from "@/lib/providers/registry";
import {
  SCRAPE_PROVIDER_LABELS,
  scrapeMediaKeyFor,
  type ScrapeAudioVersion,
  type ScrapeMediaInput,
  type ScrapeProviderId,
  type ScrapeQuality,
  type ScrapeSubtitle,
} from "@/lib/scrape/types";
import type { ScrapePlaybackPayload } from "@/lib/playback/to-playable-manifest";

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

type UseScrapeOptions = {
  onAllProvidersFailed?: () => void;
};

export function useScrape(options?: UseScrapeOptions) {
  const flags = useFeatureFlags();
  const onAllProvidersFailed = options?.onAllProvidersFailed;

  const providerOrder = useMemo(
    () =>
      filterTmdbScrapeProviderIds(flags, getTmdbScrapeProviderMenuOrder(flags)),
    [flags],
  );

  const buildScrapeBody = useCallback(
    (input: ScrapeMediaInput, providerId: string) => ({
      mediaKind: "tmdb" as const,
      providerId,
      mediaType: input.mediaType,
      tmdbId: input.tmdbId,
      seasonNumber: input.seasonNumber,
      episodeNumber: input.episodeNumber,
      preferMultiTrack: input.preferMultiTrack,
      preferredAudioLang: input.preferredAudioLang,
    }),
    [],
  );

  const mapResult = useCallback(
    (payload: ScrapePlaybackPayload): ScrapeSuccessPayload => ({
      ...payload,
      providerId: payload.providerId as ScrapeProviderId,
      providerName:
        SCRAPE_PROVIDER_LABELS[payload.providerId as ScrapeProviderId] ??
        payload.providerName,
    }),
    [],
  );

  return usePlaybackResolve<ScrapeMediaInput, ScrapeSuccessPayload>({
    mediaKeyFor: scrapeMediaKeyFor,
    providerOrderFor: () => providerOrder,
    providerLabels: TMDB_SCRAPE_PROVIDER_LABELS,
    buildScrapeBody,
    onAllProvidersFailed,
    mapResult,
  });
}

export type UseScrapeReturn = ReturnType<typeof useScrape>;
