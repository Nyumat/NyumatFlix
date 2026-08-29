"use client";

import { useMemo } from "react";

import { useFeatureFlags } from "@/components/providers/feature-flags-provider";
import {
  filterAnimeScrapeProviderIds,
  getAnimeScrapeProviderMenuOrder,
} from "@/lib/flags/site-flags";
import { useProviderScrapeLoop } from "@/hooks/use-provider-scrape-loop";
import {
  scoreAnimeScrapePayload,
  type PlaybackPreferences,
} from "@/lib/playback/playback-preferences";
import { useAppSettingsStore } from "@/lib/stores/app-settings-store";
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
  nativeAudioTrackCount?: number;
  nativeSubtitleTrackCount?: number;
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
    ...(input.tmdb ? { tmdb: input.tmdb } : {}),
  }),
  harvestSubtitleProviders: (
    winnerId: AnimeScrapeProviderId,
    order: readonly AnimeScrapeProviderId[],
    failed: ReadonlySet<AnimeScrapeProviderId>,
  ) =>
    order.filter(
      (providerId) => providerId !== winnerId && !failed.has(providerId),
    ),
} as const;

export function useAnimeScrape() {
  const flags = useFeatureFlags();
  const playbackAudio = useAppSettingsStore((state) => state.playbackAudio);
  const playbackQuality = useAppSettingsStore((state) => state.playbackQuality);
  const playbackEnglishSubtitles = useAppSettingsStore(
    (state) => state.playbackEnglishSubtitles,
  );
  const config = useMemo(() => {
    const playbackPreferences: PlaybackPreferences = {
      playbackAudio,
      playbackQuality,
      playbackEnglishSubtitles,
    };

    return {
      ...animeScrapeLoopConfig,
      providerOrder: filterAnimeScrapeProviderIds(
        flags,
        getAnimeScrapeProviderMenuOrder(flags),
      ) as typeof ANIME_SCRAPE_PROVIDER_ORDER,
      raceFirstWin: false,
      scoreRacePayload: (payload: AnimeScrapeSuccessPayload) =>
        scoreAnimeScrapePayload(payload, playbackPreferences),
    };
  }, [flags, playbackAudio, playbackEnglishSubtitles, playbackQuality]);

  return useProviderScrapeLoop<
    AnimeScrapeProviderId,
    AnimeScrapeInput,
    AnimeScrapeSuccessPayload
  >(config);
}

export type UseAnimeScrapeReturn = ReturnType<typeof useAnimeScrape>;
