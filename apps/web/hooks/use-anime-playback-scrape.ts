"use client";

import { useMemo } from "react";

import { useFeatureFlags } from "@/components/providers/feature-flags-provider";
import {
  isAnimeScrapeProviderEnabled,
  isTmdbScrapeProviderEnabled,
  getAnimePlaybackProviderOrders,
} from "@/lib/flags/site-flags";
import { useProviderScrapeLoop } from "@/hooks/use-provider-scrape-loop";
import {
  buildAnimePlaybackProviderOrder,
  type AnimePlaybackChainContext,
} from "@/lib/providers/anime-playback-chain";
import type { AnimeScrapeInput } from "@/lib/scrape/anime/types";
import { animeScrapeMediaKeyFor } from "@/lib/scrape/anime/types";
import type { StreamKind } from "@/lib/scrape/stream-url-patterns";
import { preferredAudioLangForTranslation } from "@/lib/scrape/anime/audio-preference";
import {
  scoreAnimeScrapePayload,
  payloadMatchesPlaybackPreferences,
  type PlaybackPreferences,
} from "@/lib/playback/playback-preferences";
import { useAppSettingsStore } from "@/lib/stores/app-settings-store";
import type {
  ScrapeAudioVersion,
  ScrapeMediaInput,
  ScrapeQuality,
  ScrapeSubtitle,
} from "@/lib/scrape/types";
import {
  ANIME_PLAYBACK_SCRAPE_PROVIDER_LABELS,
  ANIME_SCRAPE_PROVIDER_ORDER,
  isAnimeScrapeProvider,
  isTmdbScrapeProvider,
  type AnimePlaybackScrapeProviderId,
} from "@/lib/providers/registry";
import { ANIME_PLAYBACK_SOLO_FIRST_PROVIDERS } from "@/lib/scrape/provider-race";

export type AnimePlaybackScrapePlayerStatus =
  | "idle"
  | "scraping"
  | "playing"
  | "error";

export type AnimePlaybackScrapeInput = {
  anime: AnimeScrapeInput;
  tmdb: ScrapeMediaInput | null;
  chain: AnimePlaybackChainContext;
};

export type AnimePlaybackScrapeSuccessPayload = {
  providerId: AnimePlaybackScrapeProviderId;
  providerName: string;
  playUrl: string;
  streamKind?: StreamKind;
  referer?: string;
  qualities?: ScrapeQuality[];
  subtitles?: ScrapeSubtitle[];
  audioVersions?: ScrapeAudioVersion[];
  nativeAudioTrackCount?: number;
  nativeSubtitleTrackCount?: number;
  defaultAudioLang?: string;
  defaultHardSubLang?: string;
  preferredAudioLang?: string;
  directPlayback?: "hls" | "direct" | "extended";
  directFallbackUrl?: string;
  directStreamName?: string;
  directFileName?: string;
};

const animePlaybackScrapeLoopConfig = {
  providerOrder: ANIME_SCRAPE_PROVIDER_ORDER,
  resolveProviderOrder: (input: AnimePlaybackScrapeInput) =>
    buildAnimePlaybackProviderOrder(input.chain),
  providerLabels: ANIME_PLAYBACK_SCRAPE_PROVIDER_LABELS,
  soloFirstProviders: ANIME_PLAYBACK_SOLO_FIRST_PROVIDERS,
  mediaKeyFor: (input: AnimePlaybackScrapeInput) =>
    animeScrapeMediaKeyFor(input.anime),
  allFailedError: "No playable source found.",
  apiPath: "/api/scrape",
  buildRequestBody: (
    providerId: AnimePlaybackScrapeProviderId,
    input: AnimePlaybackScrapeInput,
  ) => {
    if (isTmdbScrapeProvider(providerId)) {
      if (!input.tmdb) {
        throw new Error("TMDB context is required for this provider.");
      }

      return {
        mediaKind: "tmdb" as const,
        providerId,
        mediaType: input.tmdb.mediaType,
        tmdbId: input.tmdb.tmdbId,
        seasonNumber: input.tmdb.seasonNumber,
        episodeNumber: input.tmdb.episodeNumber,
        preferMultiTrack: providerId === "direct",
        preferredAudioLang: preferredAudioLangForTranslation(
          input.anime.translationType,
        ),
      };
    }

    return {
      mediaKind: "anime" as const,
      providerId,
      anilistId: input.anime.anilistId,
      episodeNumber: input.anime.episodeNumber,
      translationType: input.anime.translationType,
      query: input.anime.query,
      ...(input.tmdb
        ? {
            tmdb: {
              mediaType: input.tmdb.mediaType,
              tmdbId: input.tmdb.tmdbId,
              seasonNumber: input.tmdb.seasonNumber,
              episodeNumber: input.tmdb.episodeNumber,
            },
          }
        : {}),
    };
  },
} as const;

export function useAnimePlaybackScrape(options?: {
  onAllProvidersFailed?: () => void;
}) {
  const flags = useFeatureFlags();
  const onAllProvidersFailed = options?.onAllProvidersFailed;
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
      ...animePlaybackScrapeLoopConfig,
      resolveProviderOrder: (input: AnimePlaybackScrapeInput) => {
        const orders = getAnimePlaybackProviderOrders(flags);
        const order = buildAnimePlaybackProviderOrder(input.chain, orders);
        return order.filter((providerId) =>
          isTmdbScrapeProvider(providerId)
            ? isTmdbScrapeProviderEnabled(flags, providerId)
            : isAnimeScrapeProviderEnabled(flags, providerId),
        );
      },
      onAllProvidersFailed,
      soloFirstProviders: ANIME_PLAYBACK_SOLO_FIRST_PROVIDERS,
      raceFirstWin: false,
      scoreRacePayload: (payload: AnimePlaybackScrapeSuccessPayload) =>
        scoreAnimeScrapePayload(payload, playbackPreferences),
      matchesPlaybackPreferences: (
        payload: AnimePlaybackScrapeSuccessPayload,
      ) => payloadMatchesPlaybackPreferences(payload, playbackPreferences),
      harvestSubtitleProviders: (
        winnerId: AnimePlaybackScrapeProviderId,
        order: readonly AnimePlaybackScrapeProviderId[],
        failed: ReadonlySet<AnimePlaybackScrapeProviderId>,
      ) => {
        if (winnerId === "direct") {
          return [];
        }

        return order.filter(
          (providerId) =>
            providerId !== winnerId &&
            isAnimeScrapeProvider(providerId) &&
            !failed.has(providerId),
        );
      },
    };
  }, [
    flags,
    onAllProvidersFailed,
    playbackAudio,
    playbackEnglishSubtitles,
    playbackQuality,
  ]);

  return useProviderScrapeLoop<
    AnimePlaybackScrapeProviderId,
    AnimePlaybackScrapeInput,
    AnimePlaybackScrapeSuccessPayload
  >(config);
}

export type UseAnimePlaybackScrapeReturn = ReturnType<
  typeof useAnimePlaybackScrape
>;
