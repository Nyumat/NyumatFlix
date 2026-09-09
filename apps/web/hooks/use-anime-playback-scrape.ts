"use client";

import { useCallback, useMemo } from "react";

import { useFeatureFlags } from "@/components/providers/feature-flags-provider";
import { usePlaybackResolve } from "@/hooks/use-playback-resolve";
import {
  isAnimeScrapeProviderEnabled,
  isTmdbScrapeProviderEnabled,
  getAnimePlaybackProviderOrders,
} from "@/lib/flags/site-flags";
import {
  buildAnimePlaybackProviderOrder,
  type AnimePlaybackChainContext,
} from "@/lib/providers/anime-playback-chain";
import type { AnimeScrapeInput } from "@/lib/scrape/anime/types";
import { animeScrapeMediaKeyFor } from "@/lib/scrape/anime/types";
import type { StreamKind } from "@/lib/scrape/stream-url-patterns";
import { preferredAudioLangForTranslation } from "@/lib/scrape/anime/audio-preference";
import type {
  ScrapeAudioVersion,
  ScrapeMediaInput,
  ScrapeQuality,
  ScrapeSubtitle,
} from "@/lib/scrape/types";
import type { ScrapePlaybackPayload } from "@/lib/playback/to-playable-manifest";
import {
  ANIME_PLAYBACK_SCRAPE_PROVIDER_LABELS,
  isAnimeScrapeProvider,
  isTmdbScrapeProvider,
  type AnimePlaybackScrapeProviderId,
} from "@/lib/providers/registry";

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

export function useAnimePlaybackScrape(options?: {
  onAllProvidersFailed?: () => void;
}) {
  const flags = useFeatureFlags();
  const onAllProvidersFailed = options?.onAllProvidersFailed;
  const animePlaybackProviderOrders = useMemo(
    () => getAnimePlaybackProviderOrders(flags),
    [flags],
  );

  const resolveProviderOrder = useCallback(
    (input: AnimePlaybackScrapeInput) => {
      const order = buildAnimePlaybackProviderOrder(
        input.chain,
        animePlaybackProviderOrders,
      );
      return order.filter((providerId) =>
        isTmdbScrapeProvider(providerId)
          ? isTmdbScrapeProviderEnabled(flags, providerId)
          : isAnimeScrapeProviderEnabled(flags, providerId),
      );
    },
    [animePlaybackProviderOrders, flags],
  );

  const buildScrapeBody = useCallback(
    (input: AnimePlaybackScrapeInput, providerId: string) => {
      if (isTmdbScrapeProvider(providerId) && input.tmdb) {
        return {
          mediaKind: "tmdb" as const,
          providerId,
          mediaType: input.tmdb.mediaType,
          tmdbId: input.tmdb.tmdbId,
          seasonNumber: input.tmdb.seasonNumber,
          episodeNumber: input.tmdb.episodeNumber,
          preferMultiTrack: true,
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
        ...(input.anime.tmdb ? { tmdb: input.anime.tmdb } : {}),
      };
    },
    [],
  );

  const mapResult = useCallback(
    (payload: ScrapePlaybackPayload): AnimePlaybackScrapeSuccessPayload => ({
      ...payload,
      providerId: payload.providerId as AnimePlaybackScrapeProviderId,
      providerName:
        ANIME_PLAYBACK_SCRAPE_PROVIDER_LABELS[
          payload.providerId as AnimePlaybackScrapeProviderId
        ] ?? payload.providerName,
    }),
    [],
  );

  return usePlaybackResolve<
    AnimePlaybackScrapeInput,
    AnimePlaybackScrapeSuccessPayload
  >({
    mediaKeyFor: (input) => animeScrapeMediaKeyFor(input.anime),
    providerOrderFor: resolveProviderOrder,
    providerLabels: ANIME_PLAYBACK_SCRAPE_PROVIDER_LABELS,
    buildScrapeBody,
    onAllProvidersFailed,
    mapResult,
  });
}

export type UseAnimePlaybackScrapeReturn = ReturnType<
  typeof useAnimePlaybackScrape
>;
