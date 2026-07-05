"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";

import type { HeroScrapeChrome } from "@/components/hero/hero-scrape-types";
import { useAnimeScrape } from "@/hooks/use-anime-scrape";
import { useScrape } from "@/hooks/use-scrape";
import { useServerAvailabilityQuery } from "@/hooks/use-server-availability-query";
import { detectMediaType } from "@/lib/media/detect-media-type";
import { formatPlaybackTitle } from "@/lib/playback/playback-title";
import type { PlaybackProgressKey } from "@/lib/playback/progress-storage";
import {
  ANIME_SCRAPE_PROVIDER_OPTIONS,
  animeScrapeMediaKeyFor,
  type AnimeScrapeProviderId,
} from "@/lib/scrape/anime/types";
import { buildSourceOverlayItems } from "@/lib/scrape/source-overlay";
import {
  SCRAPE_PROVIDER_ORDER,
  SCRAPE_PROVIDER_OPTIONS,
  scrapeMediaKeyFor,
  type ScrapeMediaInput,
  type ScrapeProviderId,
} from "@/lib/scrape/types";
import type { ServerAvailabilityInput } from "@/lib/stores/embed-server-store";
import { useAppSettingsStore } from "@/lib/stores/app-settings-store";
import { useEpisodeStore } from "@/lib/stores/episode-store";
import {
  isScrapeServer,
  useServerStore,
  videoServers,
} from "@/lib/stores/server-store";
import type { MediaItem } from "@/lib/domain/typings";

type UseHeroScrapePlaybackOptions = {
  media: MediaItem;
  mediaType?: "tv" | "movie";
  isPlayingVideo: boolean;
};

export function useHeroScrapePlayback({
  media,
  mediaType,
  isPlayingVideo,
}: UseHeroScrapePlaybackOptions) {
  const {
    selectedEpisode,
    tvShowId,
    seasonNumber,
    providerEpisodeNumber,
    isAnimeEpisode,
    anilistId: episodeAnilistId,
    relativeEpisodeNumber,
    advanceToNextEpisode,
  } = useEpisodeStore();
  const {
    selectedServer,
    setSelectedServer,
    getFallbackEmbedServer,
    animePreference,
    availableServerIds,
    unavailableServerIds,
  } = useServerStore();
  const noAdsMode = useAppSettingsStore((state) => state.noAdsMode);

  const mediaScrape = useScrape();
  const animeScrape = useAnimeScrape();

  const mediaScrapeRef = useRef(mediaScrape);
  mediaScrapeRef.current = mediaScrape;
  const animeScrapeRef = useRef(animeScrape);
  animeScrapeRef.current = animeScrape;

  const lastScrapeMediaKeyRef = useRef<string | null>(null);
  const scrapeFallbackHandledRef = useRef<string | null>(null);
  const isPlayingVideoRef = useRef(isPlayingVideo);
  isPlayingVideoRef.current = isPlayingVideo;

  const isAnimeScrapeMode =
    isAnimeEpisode &&
    typeof episodeAnilistId === "number" &&
    episodeAnilistId > 0 &&
    typeof relativeEpisodeNumber === "number" &&
    relativeEpisodeNumber > 0;

  const activeScrape = isAnimeScrapeMode ? animeScrape : mediaScrape;
  const isScrapeMode = isScrapeServer(selectedServer);

  const stopScraping = useCallback(() => {
    mediaScrapeRef.current.stopScraping();
    animeScrapeRef.current.stopScraping();
  }, []);

  const resolvedMediaType = useMemo(
    () =>
      detectMediaType({
        media,
        mediaType,
        pathname:
          typeof window !== "undefined" ? window.location.pathname : undefined,
      }),
    [media, mediaType],
  );

  const playbackTitle = useMemo(
    () =>
      formatPlaybackTitle({
        showTitle: (media.title || media.name || "Now playing") as string,
        mediaType: resolvedMediaType,
        seasonNumber,
        episode: selectedEpisode,
      }),
    [media.name, media.title, resolvedMediaType, seasonNumber, selectedEpisode],
  );

  const buildPlaybackProgressKey =
    useCallback((): PlaybackProgressKey | null => {
      const isTv = resolvedMediaType === "tv";
      const contentId = isTv && tvShowId ? Number(tvShowId) : media.id;

      if (!Number.isInteger(contentId) || contentId <= 0) {
        return null;
      }

      return {
        mediaType: resolvedMediaType,
        contentId,
        seasonNumber: isTv ? seasonNumber || undefined : undefined,
        episodeNumber: isTv
          ? selectedEpisode?.episode_number || undefined
          : undefined,
      };
    }, [
      media.id,
      resolvedMediaType,
      seasonNumber,
      selectedEpisode?.episode_number,
      tvShowId,
    ]);

  const buildScrapeInput = useCallback((): ScrapeMediaInput | null => {
    const isTv = resolvedMediaType === "tv";
    const tmdbId = isTv && tvShowId ? Number(tvShowId) : media.id;

    if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
      return null;
    }

    return {
      mediaType: resolvedMediaType,
      tmdbId,
      seasonNumber: isTv ? seasonNumber || undefined : undefined,
      episodeNumber: isTv
        ? (providerEpisodeNumber ?? selectedEpisode?.episode_number) ||
          undefined
        : undefined,
    };
  }, [
    media.id,
    providerEpisodeNumber,
    resolvedMediaType,
    seasonNumber,
    selectedEpisode?.episode_number,
    tvShowId,
  ]);

  const buildAnimeScrapeInput = useCallback(() => {
    if (!isAnimeScrapeMode) {
      return null;
    }

    return {
      anilistId: episodeAnilistId!,
      episodeNumber: relativeEpisodeNumber!,
      translationType: animePreference,
    };
  }, [
    animePreference,
    episodeAnilistId,
    isAnimeScrapeMode,
    relativeEpisodeNumber,
  ]);

  const getCurrentMediaKey = useCallback((): string | null => {
    if (isAnimeScrapeMode) {
      const animeInput = buildAnimeScrapeInput();
      return animeInput ? animeScrapeMediaKeyFor(animeInput) : null;
    }

    const input = buildScrapeInput();
    return input ? scrapeMediaKeyFor(input) : null;
  }, [buildAnimeScrapeInput, buildScrapeInput, isAnimeScrapeMode]);

  const startScrapingForCurrentMedia = useCallback(() => {
    if (!isScrapeServer(selectedServer)) {
      return;
    }

    if (isAnimeScrapeMode) {
      const animeInput = buildAnimeScrapeInput();
      if (!animeInput) {
        return;
      }

      const mediaKey = animeScrapeMediaKeyFor(animeInput);
      if (lastScrapeMediaKeyRef.current === mediaKey) {
        return;
      }

      lastScrapeMediaKeyRef.current = mediaKey;
      animeScrapeRef.current.startScraping(animeInput);
      return;
    }

    const input = buildScrapeInput();
    if (!input) {
      return;
    }

    const mediaKey = scrapeMediaKeyFor(input);
    if (lastScrapeMediaKeyRef.current === mediaKey) {
      return;
    }

    lastScrapeMediaKeyRef.current = mediaKey;
    mediaScrapeRef.current.startScraping(input);
  }, [
    buildAnimeScrapeInput,
    buildScrapeInput,
    isAnimeScrapeMode,
    selectedServer,
  ]);

  const stopScrapingPlayback = useCallback(() => {
    lastScrapeMediaKeyRef.current = null;
    if (activeScrape.status !== "idle") {
      stopScraping();
    }
  }, [activeScrape.status, stopScraping]);

  const onPlaybackStart = useCallback(() => {
    scrapeFallbackHandledRef.current = null;
    startScrapingForCurrentMedia();
  }, [startScrapingForCurrentMedia]);

  const onPlaybackStop = useCallback(() => {
    scrapeFallbackHandledRef.current = null;
    stopScrapingPlayback();
  }, [stopScrapingPlayback]);

  const scrapeContextKey = getCurrentMediaKey() ?? "";

  useEffect(() => {
    if (!isPlayingVideoRef.current) {
      return;
    }

    if (isScrapeMode) {
      startScrapingForCurrentMedia();
      return;
    }

    stopScrapingPlayback();
  }, [
    isScrapeMode,
    scrapeContextKey,
    selectedServer.id,
    startScrapingForCurrentMedia,
    stopScrapingPlayback,
  ]);

  const serverAvailabilityInput =
    useMemo((): ServerAvailabilityInput | null => {
      const isTv = resolvedMediaType === "tv";
      const tmdbId = isTv && tvShowId ? Number(tvShowId) : media.id;

      if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
        return null;
      }

      return {
        tmdbId,
        mediaType: isTv ? "tv" : "movie",
        seasonNumber: seasonNumber || undefined,
        episodeNumber: providerEpisodeNumber ?? selectedEpisode?.episode_number,
        anilistId: isAnimeEpisode ? episodeAnilistId || undefined : undefined,
        animeEpisodeNumber: isAnimeEpisode
          ? relativeEpisodeNumber || undefined
          : undefined,
        animePreference,
      };
    }, [
      animePreference,
      episodeAnilistId,
      isAnimeEpisode,
      media.id,
      providerEpisodeNumber,
      relativeEpisodeNumber,
      resolvedMediaType,
      seasonNumber,
      selectedEpisode?.episode_number,
      tvShowId,
    ]);

  useServerAvailabilityQuery(serverAvailabilityInput);

  useEffect(() => {
    if (
      !isPlayingVideo ||
      !isScrapeMode ||
      activeScrape.status !== "error" ||
      noAdsMode
    ) {
      return;
    }

    const mediaKey = getCurrentMediaKey();
    if (!mediaKey || scrapeFallbackHandledRef.current === mediaKey) {
      return;
    }

    scrapeFallbackHandledRef.current = mediaKey;
    setSelectedServer(getFallbackEmbedServer());
    toast.error("No sources found, switching select fallback.");
  }, [
    activeScrape.status,
    getCurrentMediaKey,
    getFallbackEmbedServer,
    isPlayingVideo,
    isScrapeMode,
    noAdsMode,
    setSelectedServer,
  ]);

  const handleScrapedPlaybackError = useCallback(() => {
    const scrape = isAnimeScrapeMode
      ? animeScrapeRef.current
      : mediaScrapeRef.current;

    if (!scrape.result?.providerId) {
      return;
    }

    if (isAnimeScrapeMode) {
      const animeInput = buildAnimeScrapeInput();
      if (!animeInput) {
        return;
      }

      animeScrapeRef.current.resumeScraping(
        animeInput,
        scrape.result.providerId as AnimeScrapeProviderId,
      );
      return;
    }

    const input = buildScrapeInput();
    if (!input) {
      return;
    }

    mediaScrapeRef.current.resumeScraping(
      input,
      scrape.result.providerId as ScrapeProviderId,
    );
  }, [buildAnimeScrapeInput, buildScrapeInput, isAnimeScrapeMode]);

  const sourceOverlayItems = useMemo(
    () =>
      buildSourceOverlayItems({
        scrapeItems: activeScrape.items,
        embedServers: videoServers,
        availableServerIds,
        unavailableServerIds,
      }),
    [activeScrape.items, availableServerIds, unavailableServerIds],
  );

  const handleSelectEmbedServer = useCallback(
    (serverId: string) => {
      const server = videoServers.find((entry) => entry.id === serverId);
      if (!server) {
        return;
      }

      scrapeFallbackHandledRef.current = null;
      stopScraping();
      setSelectedServer(server);
    },
    [setSelectedServer, stopScraping],
  );

  const handleSelectScrapeProvider = useCallback(
    (providerId: string) => {
      const scrape = isAnimeScrapeMode
        ? animeScrapeRef.current
        : mediaScrapeRef.current;

      if (
        scrape.status === "playing" &&
        scrape.result?.providerId === providerId
      ) {
        return;
      }

      if (isAnimeScrapeMode) {
        const animeInput = buildAnimeScrapeInput();
        if (!animeInput) {
          return;
        }

        animeScrapeRef.current.switchToProvider(
          animeInput,
          providerId as AnimeScrapeProviderId,
        );
        return;
      }

      const input = buildScrapeInput();
      if (!input) {
        return;
      }

      mediaScrapeRef.current.switchToProvider(
        input,
        providerId as ScrapeProviderId,
      );
    },
    [buildAnimeScrapeInput, buildScrapeInput, isAnimeScrapeMode],
  );

  const scrapeProviderOptions = isAnimeScrapeMode
    ? ANIME_SCRAPE_PROVIDER_OPTIONS
    : SCRAPE_PROVIDER_OPTIONS;

  const canFindNextSource = (() => {
    if (
      !isScrapeMode ||
      activeScrape.status !== "playing" ||
      !activeScrape.result?.providerId
    ) {
      return false;
    }

    const providerOrder = isAnimeScrapeMode
      ? ANIME_SCRAPE_PROVIDER_OPTIONS.map((entry) => entry.providerId)
      : [...SCRAPE_PROVIDER_ORDER];
    const currentIndex = providerOrder.indexOf(activeScrape.result.providerId);
    return currentIndex >= 0 && currentIndex < providerOrder.length - 1;
  })();

  const scrapeChrome = useMemo((): HeroScrapeChrome => {
    return {
      scrapeStatus: activeScrape.status,
      activeProviderId:
        isScrapeMode && activeScrape.status === "playing"
          ? (activeScrape.result?.providerId ?? null)
          : null,
      activeProviderName:
        isScrapeMode && activeScrape.status === "playing"
          ? (activeScrape.result?.providerName ?? null)
          : null,
      scrapeProviders: scrapeProviderOptions,
      onSelectScrapeProvider: isScrapeMode ? handleSelectScrapeProvider : null,
      onFindNextSource: canFindNextSource ? handleScrapedPlaybackError : null,
      canFindNextSource,
    };
  }, [
    activeScrape.result?.providerId,
    activeScrape.result?.providerName,
    activeScrape.status,
    canFindNextSource,
    handleScrapedPlaybackError,
    handleSelectScrapeProvider,
    isScrapeMode,
    scrapeProviderOptions,
  ]);

  const handleScrapePlaybackEnded = useCallback(async () => {
    if (resolvedMediaType !== "tv") {
      return;
    }

    const advanced = await advanceToNextEpisode();
    if (advanced && isPlayingVideo && isScrapeMode) {
      lastScrapeMediaKeyRef.current = null;
      startScrapingForCurrentMedia();
    }
  }, [
    advanceToNextEpisode,
    isPlayingVideo,
    isScrapeMode,
    resolvedMediaType,
    startScrapingForCurrentMedia,
  ]);

  return {
    resolvedMediaType,
    playbackTitle,
    buildPlaybackProgressKey,
    isAnimeScrapeMode,
    activeScrape,
    animeScrape,
    sourceOverlayItems,
    scrapeChrome,
    onPlaybackStart,
    onPlaybackStop,
    handleSelectEmbedServer,
    handleScrapedPlaybackError,
    handleScrapePlaybackEnded,
  };
}
