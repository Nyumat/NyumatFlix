"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";

import { useFeatureFlagsOptional } from "@/components/providers/feature-flags-provider";
import {
  isAnimeScrapeProviderEnabled,
  isTmdbScrapeProviderEnabled,
} from "@/lib/flags/site-flags";
import type { HeroScrapeChrome } from "@/components/hero/hero-scrape-types";
import { useAnimePlaybackScrape } from "@/hooks/use-anime-playback-scrape";
import { useScrape } from "@/hooks/use-scrape";
import { useServerAvailabilityQuery } from "@/hooks/use-server-availability-query";
import { detectMediaType } from "@/lib/media/detect-media-type";
import { formatPlaybackTitle } from "@/lib/playback/playback-title";
import type { PlaybackProgressKey } from "@/lib/playback/progress-storage";
import {
  buildAnimePlaybackProviderOrder,
  buildGroupedAnimePlaybackProviderOptions,
} from "@/lib/providers/anime-playback-chain";
import { type AnimePlaybackScrapeProviderId } from "@/lib/providers/registry";
import { animeScrapeMediaKeyFor } from "@/lib/scrape/anime/types";
import { buildSourceOverlayItems } from "@/lib/scrape/source-overlay";
import { areScrapeProvidersExhausted } from "@/lib/scrape/scrape-provider-menu";
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
    animeSeasonNumber,
    mappingConfidence,
    isAdultAnime,
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
  const flags = useFeatureFlagsOptional();

  const filterProviderOptions = useCallback(
    (
      options:
        | ReturnType<typeof buildGroupedAnimePlaybackProviderOptions>
        | typeof SCRAPE_PROVIDER_OPTIONS,
    ) => {
      if (!flags) return options;
      return options.filter((provider) => {
        if ("group" in provider && provider.group === "anime") {
          return isAnimeScrapeProviderEnabled(flags, provider.providerId);
        }
        return isTmdbScrapeProviderEnabled(flags, provider.providerId);
      });
    },
    [flags],
  );

  const filterProviderOrder = useCallback(
    (order: readonly AnimePlaybackScrapeProviderId[] | ScrapeProviderId[]) => {
      if (!flags) return [...order];
      return order.filter((providerId) => {
        if (providerId in flags.animeScrapeProviders) {
          return isAnimeScrapeProviderEnabled(flags, providerId);
        }
        return isTmdbScrapeProviderEnabled(flags, providerId);
      });
    },
    [flags],
  );

  const mediaScrape = useScrape();
  const animePlaybackScrape = useAnimePlaybackScrape();

  const mediaScrapeRef = useRef(mediaScrape);
  mediaScrapeRef.current = mediaScrape;
  const animePlaybackScrapeRef = useRef(animePlaybackScrape);
  animePlaybackScrapeRef.current = animePlaybackScrape;

  const lastScrapeMediaKeyRef = useRef<string | null>(null);
  const preferredScrapeProviderIdRef = useRef<string | null>(null);
  const scrapeFallbackHandledRef = useRef<string | null>(null);
  const isPlayingVideoRef = useRef(isPlayingVideo);
  isPlayingVideoRef.current = isPlayingVideo;

  const isAnimeScrapeMode =
    isAnimeEpisode &&
    typeof episodeAnilistId === "number" &&
    episodeAnilistId > 0 &&
    typeof relativeEpisodeNumber === "number" &&
    relativeEpisodeNumber > 0;

  const activeScrape = isAnimeScrapeMode ? animePlaybackScrape : mediaScrape;
  const isScrapeMode = isScrapeServer(selectedServer);

  const stopScraping = useCallback(() => {
    mediaScrapeRef.current.stopScraping();
    animePlaybackScrapeRef.current.stopScraping();
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
        displaySeasonNumber: animeSeasonNumber,
        displayEpisodeNumber: relativeEpisodeNumber,
      }),
    [
      animeSeasonNumber,
      media.name,
      media.title,
      relativeEpisodeNumber,
      resolvedMediaType,
      seasonNumber,
      selectedEpisode,
    ],
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
      query: String(media.title || media.name || "").trim() || undefined,
    };
  }, [
    animePreference,
    episodeAnilistId,
    isAnimeScrapeMode,
    media.name,
    media.title,
    relativeEpisodeNumber,
  ]);

  const anilistGenres = useMemo(
    () =>
      "genres" in media && Array.isArray(media.genres)
        ? media.genres
            .map((genre) => genre.name)
            .filter((name): name is string => Boolean(name))
        : [],
    [media],
  );

  const buildAnimePlaybackInput = useCallback(() => {
    const animeInput = buildAnimeScrapeInput();
    const tmdbInput = buildScrapeInput();
    if (!animeInput || !tmdbInput) {
      return null;
    }

    return {
      anime: animeInput,
      tmdb: tmdbInput,
      chain: {
        mappingConfidence,
        isAdultAnime,
        anilistGenres,
        translationType: animePreference,
      },
    };
  }, [
    anilistGenres,
    buildAnimeScrapeInput,
    buildScrapeInput,
    isAdultAnime,
    mappingConfidence,
    animePreference,
  ]);

  const getCurrentMediaKey = useCallback((): string | null => {
    if (isAnimeScrapeMode) {
      const animeInput = buildAnimeScrapeInput();
      return animeInput ? animeScrapeMediaKeyFor(animeInput) : null;
    }

    const input = buildScrapeInput();
    return input ? scrapeMediaKeyFor(input) : null;
  }, [buildAnimePlaybackInput, buildScrapeInput, isAnimeScrapeMode]);

  const startScrapingForCurrentMedia = useCallback(() => {
    if (!isScrapeServer(selectedServer)) {
      return;
    }

    if (isAnimeScrapeMode) {
      const playbackInput = buildAnimePlaybackInput();
      if (!playbackInput) {
        return;
      }

      const mediaKey = animeScrapeMediaKeyFor(playbackInput.anime);
      if (lastScrapeMediaKeyRef.current === mediaKey) {
        return;
      }

      lastScrapeMediaKeyRef.current = mediaKey;
      animePlaybackScrapeRef.current.startScraping(
        playbackInput,
        preferredScrapeProviderIdRef.current as
          | AnimePlaybackScrapeProviderId
          | undefined,
      );
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
    mediaScrapeRef.current.startScraping(
      input,
      preferredScrapeProviderIdRef.current as ScrapeProviderId | undefined,
    );
  }, [
    buildAnimePlaybackInput,
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
    if (
      isScrapeMode &&
      activeScrape.status === "playing" &&
      activeScrape.result?.providerId
    ) {
      preferredScrapeProviderIdRef.current = activeScrape.result.providerId;
    }
  }, [activeScrape.result?.providerId, activeScrape.status, isScrapeMode]);

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

  const handleScrapedPlaybackError = useCallback(() => {
    const scrape = isAnimeScrapeMode
      ? animePlaybackScrapeRef.current
      : mediaScrapeRef.current;

    if (!scrape.result?.providerId) {
      return;
    }

    if (isAnimeScrapeMode) {
      const playbackInput = buildAnimePlaybackInput();
      if (!playbackInput) {
        return;
      }

      animePlaybackScrapeRef.current.resumeScraping(
        playbackInput,
        scrape.result.providerId as AnimePlaybackScrapeProviderId,
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
  }, [buildAnimePlaybackInput, buildScrapeInput, isAnimeScrapeMode]);

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
        ? animePlaybackScrapeRef.current
        : mediaScrapeRef.current;

      if (
        scrape.status === "playing" &&
        scrape.result?.providerId === providerId
      ) {
        return;
      }

      if (isAnimeScrapeMode) {
        const playbackInput = buildAnimePlaybackInput();
        if (!playbackInput) {
          return;
        }

        animePlaybackScrapeRef.current.switchToProvider(
          playbackInput,
          providerId as AnimePlaybackScrapeProviderId,
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
    [buildAnimePlaybackInput, buildScrapeInput, isAnimeScrapeMode],
  );

  const animePlaybackChainContext = useMemo(
    () => ({
      mappingConfidence,
      isAdultAnime,
      anilistGenres,
    }),
    [anilistGenres, isAdultAnime, mappingConfidence],
  );

  useEffect(() => {
    if (
      !isPlayingVideo ||
      !isScrapeMode ||
      activeScrape.status !== "error" ||
      noAdsMode
    ) {
      return;
    }

    const providerOrder = filterProviderOrder(
      isAnimeScrapeMode
        ? buildAnimePlaybackProviderOrder(animePlaybackChainContext)
        : [...SCRAPE_PROVIDER_ORDER],
    );

    if (!areScrapeProvidersExhausted(activeScrape.items, providerOrder)) {
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
    activeScrape.items,
    activeScrape.status,
    animePlaybackChainContext,
    filterProviderOrder,
    getCurrentMediaKey,
    getFallbackEmbedServer,
    isAnimeScrapeMode,
    isPlayingVideo,
    isScrapeMode,
    noAdsMode,
    setSelectedServer,
  ]);

  const scrapeProviderOptions = filterProviderOptions(
    isAnimeScrapeMode
      ? buildGroupedAnimePlaybackProviderOptions(animePlaybackChainContext)
      : SCRAPE_PROVIDER_OPTIONS,
  );

  const canFindNextSource = (() => {
    if (
      !isScrapeMode ||
      activeScrape.status !== "playing" ||
      !activeScrape.result?.providerId
    ) {
      return false;
    }

    const providerOrder = filterProviderOrder(
      isAnimeScrapeMode
        ? buildAnimePlaybackProviderOrder(animePlaybackChainContext)
        : [...SCRAPE_PROVIDER_ORDER],
    );
    const currentIndex = providerOrder.indexOf(activeScrape.result.providerId);
    return currentIndex >= 0 && currentIndex < providerOrder.length - 1;
  })();

  const scrapeChrome = useMemo((): HeroScrapeChrome => {
    return {
      scrapeStatus: activeScrape.status,
      activeProviderId:
        isScrapeMode && activeScrape.status === "playing"
          ? (activeScrape.result?.providerId ?? null)
          : activeScrape.activeProviderId,
      activeProviderName:
        isScrapeMode && activeScrape.status === "playing"
          ? (activeScrape.result?.providerName ?? null)
          : null,
      scrapeItems: isScrapeMode ? activeScrape.items : [],
      scrapeProviders: scrapeProviderOptions,
      onSelectScrapeProvider: isScrapeMode ? handleSelectScrapeProvider : null,
      onFindNextSource: canFindNextSource ? handleScrapedPlaybackError : null,
      canFindNextSource,
    };
  }, [
    activeScrape.activeProviderId,
    activeScrape.items,
    activeScrape.result?.providerId,
    activeScrape.result?.providerName,
    activeScrape.status,
    canFindNextSource,
    handleScrapedPlaybackError,
    handleSelectScrapeProvider,
    isScrapeMode,
    scrapeProviderOptions,
  ]);

  const handleRetryAllScraping = useCallback(() => {
    scrapeFallbackHandledRef.current = null;
    lastScrapeMediaKeyRef.current = null;

    if (isAnimeScrapeMode) {
      const playbackInput = buildAnimePlaybackInput();
      if (!playbackInput) {
        return;
      }

      animePlaybackScrapeRef.current.retryAllScraping(playbackInput);
      return;
    }

    const input = buildScrapeInput();
    if (!input) {
      return;
    }

    mediaScrapeRef.current.retryAllScraping(input);
  }, [buildAnimePlaybackInput, buildScrapeInput, isAnimeScrapeMode]);

  const handleScrapePlaybackEnded = useCallback(async () => {
    if (resolvedMediaType !== "tv") {
      return false;
    }

    const advanced = await advanceToNextEpisode();
    if (advanced && isPlayingVideo && isScrapeMode) {
      lastScrapeMediaKeyRef.current = null;
      startScrapingForCurrentMedia();
    }
    return advanced;
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
    sourceOverlayItems,
    scrapeChrome,
    onPlaybackStart,
    onPlaybackStop,
    handleSelectEmbedServer,
    handleScrapedPlaybackError,
    handleRetryAllScraping,
    handleScrapePlaybackEnded,
  };
}
