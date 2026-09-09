"use client";

import { useCallback, useMemo } from "react";

import { useFeatureFlags } from "@/components/providers/feature-flags-provider";
import { usePlaybackResolve } from "@/hooks/use-playback-resolve";
import {
  filterAnimeScrapeProviderIds,
  getAnimeScrapeProviderMenuOrder,
} from "@/lib/flags/site-flags";
import {
  ANIME_SCRAPE_PROVIDER_LABELS,
  animeScrapeMediaKeyFor,
  type AnimeScrapeInput,
  type AnimeScrapeProviderId,
} from "@/lib/scrape/anime/types";
import type {
  ScrapeAudioVersion,
  ScrapeQuality,
  ScrapeSubtitle,
} from "@/lib/scrape/types";
import type { ScrapePlaybackPayload } from "@/lib/playback/to-playable-manifest";

export type AnimeScrapeSuccessPayload = {
  providerId: AnimeScrapeProviderId;
  providerName: string;
  playUrl: string;
  streamKind: "hls" | "dash" | "mp4";
  referer?: string;
  qualities?: ScrapeQuality[];
  subtitles?: ScrapeSubtitle[];
  audioVersions?: ScrapeAudioVersion[];
  nativeAudioTrackCount?: number;
  nativeSubtitleTrackCount?: number;
  defaultAudioLang?: string;
  defaultHardSubLang?: string;
  preferredAudioLang?: string;
};

export function useAnimeScrape() {
  const flags = useFeatureFlags();

  const providerOrder = useMemo(
    () =>
      filterAnimeScrapeProviderIds(
        flags,
        getAnimeScrapeProviderMenuOrder(flags),
      ),
    [flags],
  );

  const buildScrapeBody = useCallback(
    (input: AnimeScrapeInput, providerId: string) => ({
      mediaKind: "anime" as const,
      providerId,
      anilistId: input.anilistId,
      episodeNumber: input.episodeNumber,
      translationType: input.translationType,
      query: input.query,
      ...(input.tmdb ? { tmdb: input.tmdb } : {}),
    }),
    [],
  );

  const mapResult = useCallback(
    (payload: ScrapePlaybackPayload): AnimeScrapeSuccessPayload => ({
      ...payload,
      providerId: payload.providerId as AnimeScrapeProviderId,
      providerName:
        ANIME_SCRAPE_PROVIDER_LABELS[payload.providerId as AnimeScrapeProviderId] ??
        payload.providerName,
      streamKind: payload.streamKind ?? "hls",
    }),
    [],
  );

  return usePlaybackResolve<AnimeScrapeInput, AnimeScrapeSuccessPayload>({
    mediaKeyFor: animeScrapeMediaKeyFor,
    providerOrderFor: () => providerOrder,
    providerLabels: ANIME_SCRAPE_PROVIDER_LABELS,
    buildScrapeBody,
    mapResult,
  });
}

export type UseAnimeScrapeReturn = ReturnType<typeof useAnimeScrape>;
