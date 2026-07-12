"use client";

import { useMemo } from "react";

import { useProviderScrapeLoop } from "@/hooks/use-provider-scrape-loop";
import {
  buildAnimePlaybackProviderOrder,
  type AnimePlaybackChainContext,
} from "@/lib/providers/anime-playback-chain";
import type { AnimeScrapeInput } from "@/lib/scrape/anime/types";
import { animeScrapeMediaKeyFor } from "@/lib/scrape/anime/types";
import type { StreamKind } from "@/lib/scrape/stream-url-patterns";
import type {
  ScrapeAudioVersion,
  ScrapeMediaInput,
  ScrapeQuality,
  ScrapeSubtitle,
} from "@/lib/scrape/types";
import {
  ANIME_PLAYBACK_SCRAPE_PROVIDER_LABELS,
  ANIME_SCRAPE_PROVIDER_ORDER,
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
  tmdb: ScrapeMediaInput;
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
  defaultAudioLang?: string;
  defaultHardSubLang?: string;
  preferredAudioLang?: string;
};

const animePlaybackScrapeLoopConfig = {
  providerOrder: ANIME_SCRAPE_PROVIDER_ORDER,
  resolveProviderOrder: (input: AnimePlaybackScrapeInput) =>
    buildAnimePlaybackProviderOrder(input.chain),
  providerLabels: ANIME_PLAYBACK_SCRAPE_PROVIDER_LABELS,
  mediaKeyFor: (input: AnimePlaybackScrapeInput) =>
    animeScrapeMediaKeyFor(input.anime),
  allFailedError: "No playable source found.",
  apiPath: "/api/scrape",
  buildRequestBody: (
    providerId: AnimePlaybackScrapeProviderId,
    input: AnimePlaybackScrapeInput,
  ) => {
    if (isTmdbScrapeProvider(providerId)) {
      return {
        mediaKind: "tmdb" as const,
        providerId,
        mediaType: input.tmdb.mediaType,
        tmdbId: input.tmdb.tmdbId,
        seasonNumber: input.tmdb.seasonNumber,
        episodeNumber: input.tmdb.episodeNumber,
      };
    }

    return {
      mediaKind: "anime" as const,
      providerId,
      anilistId: input.anime.anilistId,
      episodeNumber: input.anime.episodeNumber,
      translationType: input.anime.translationType,
      query: input.anime.query,
    };
  },
} as const;

export function useAnimePlaybackScrape() {
  return useProviderScrapeLoop<
    AnimePlaybackScrapeProviderId,
    AnimePlaybackScrapeInput,
    AnimePlaybackScrapeSuccessPayload
  >(useMemo(() => animePlaybackScrapeLoopConfig, []));
}

export type UseAnimePlaybackScrapeReturn = ReturnType<
  typeof useAnimePlaybackScrape
>;
