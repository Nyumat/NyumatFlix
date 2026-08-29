"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useFeatureFlags } from "@/components/providers/feature-flags-provider";
import {
  isAnimeScrapeProviderEnabled,
  isTmdbScrapeProviderEnabled,
} from "@/lib/flags/site-flags";
import { prefetchMoviPlayer } from "@/components/media/movi-stream-player";
import type { HeroScrapeChrome } from "@/components/hero/hero-scrape-types";
import { useAnimePlaybackScrape } from "@/hooks/use-anime-playback-scrape";
import { useDirectPlayback } from "@/hooks/use-direct-movie-playback";
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
    defaultAnilistId,
    animeCoordsStatus,
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
  const flags = useFeatureFlags();

  const filterProviderOptions = useCallback(
    (
      options:
        | ReturnType<typeof buildGroupedAnimePlaybackProviderOptions>
        | typeof SCRAPE_PROVIDER_OPTIONS,
    ) =>
      options.filter((provider) => {
        if ("group" in provider && provider.group === "anime") {
          return isAnimeScrapeProviderEnabled(flags, provider.providerId);
        }
        return isTmdbScrapeProviderEnabled(flags, provider.providerId);
      }),
    [flags],
  );

  const filterProviderOrder = useCallback(
    (order: readonly AnimePlaybackScrapeProviderId[] | ScrapeProviderId[]) =>
      order.filter((providerId) => {
        if (providerId in flags.animeScrapeProviders) {
          return isAnimeScrapeProviderEnabled(flags, providerId);
        }
        return isTmdbScrapeProviderEnabled(flags, providerId);
      }),
    [flags],
  );

  const scrapeFallbackContextRef = useRef({
    isPlayingVideo,
    isDirectMode: false,
    noAdsMode,
    selectedServer,
    getCurrentMediaKey: () => null as string | null,
    getFallbackEmbedServer,
    setSelectedServer,
  });
  const scrapeFallbackHandledRef = useRef<string | null>(null);
  const animeDirectFallbackRef = useRef({
    isAnimeScrapeMode: false,
    directAvailable: false,
  });

  const onAllProvidersFailed = useCallback(() => {
    const ctx = scrapeFallbackContextRef.current;
    if (
      !ctx.isPlayingVideo ||
      !isScrapeServer(ctx.selectedServer) ||
      ctx.noAdsMode
    ) {
      return;
    }

    const mediaKey = ctx.getCurrentMediaKey();
    if (!mediaKey || scrapeFallbackHandledRef.current === mediaKey) {
      return;
    }

    const { isAnimeScrapeMode: animeMode, directAvailable } =
      animeDirectFallbackRef.current;
    if (animeMode && directAvailable) {
      scrapeFallbackHandledRef.current = mediaKey;
      setAnimeDirectOverride(true);
      toast.message("Anime sources unavailable — trying Direct.");
      return;
    }

    scrapeFallbackHandledRef.current = mediaKey;
    ctx.setSelectedServer(ctx.getFallbackEmbedServer());
    toast.error("No sources found, switching select fallback.");
  }, [noAdsMode]);

  const mediaScrape = useScrape({ onAllProvidersFailed });
  const animePlaybackScrape = useAnimePlaybackScrape({ onAllProvidersFailed });

  const mediaScrapeRef = useRef(mediaScrape);
  mediaScrapeRef.current = mediaScrape;
  const animePlaybackScrapeRef = useRef(animePlaybackScrape);
  animePlaybackScrapeRef.current = animePlaybackScrape;

  const lastScrapeMediaKeyRef = useRef<string | null>(null);
  const preferredScrapeProviderIdRef = useRef<string | null>(null);
  const [movieScrapeOverride, setMovieScrapeOverride] =
    useState<ScrapeProviderId | null>(null);
  const [animeDirectOverride, setAnimeDirectOverride] = useState(false);
  const isPlayingVideoRef = useRef(isPlayingVideo);
  isPlayingVideoRef.current = isPlayingVideo;
  const isScrapeMode = isScrapeServer(selectedServer);

  const isAnimeScrapeMode =
    isAnimeEpisode &&
    typeof episodeAnilistId === "number" &&
    episodeAnilistId > 0 &&
    typeof relativeEpisodeNumber === "number" &&
    relativeEpisodeNumber > 0;

  const isAnimeScrapeActive = isAnimeScrapeMode && !animeDirectOverride;

  // Known anime show, but TMDB→AniList episode coords still loading — don't
  // flash the TMDB provider list in the scrape overlay.
  const awaitingAnimeCoords =
    Boolean(defaultAnilistId) &&
    Boolean(selectedEpisode) &&
    animeCoordsStatus === "pending" &&
    !isAnimeScrapeMode;

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

  const isDirectMode =
    isScrapeMode &&
    flags.directScrapeProviderAvailable &&
    movieScrapeOverride === null &&
    (!isAnimeScrapeMode || animeDirectOverride);

  const directPlayback = useDirectPlayback({
    tmdbId:
      resolvedMediaType === "tv" && tvShowId ? Number(tvShowId) : media.id,
    mediaType: resolvedMediaType,
    seasonNumber: seasonNumber || undefined,
    episodeNumber:
      providerEpisodeNumber ?? selectedEpisode?.episode_number ?? undefined,
    enabled: isDirectMode,
    onAllStreamsFailed: onAllProvidersFailed,
  });

  const directPlaybackRef = useRef(directPlayback);
  directPlaybackRef.current = directPlayback;

  useEffect(() => {
    setMovieScrapeOverride(null);
    setAnimeDirectOverride(false);
    lastScrapeMediaKeyRef.current = null;
  }, [
    media.id,
    resolvedMediaType,
    seasonNumber,
    selectedEpisode?.episode_number,
  ]);

  animeDirectFallbackRef.current = {
    isAnimeScrapeMode,
    directAvailable: flags.directScrapeProviderAvailable,
  };

  const activeScrape = isAnimeScrapeActive ? animePlaybackScrape : mediaScrape;

  const stopScraping = useCallback(() => {
    mediaScrapeRef.current.stopScraping();
    animePlaybackScrapeRef.current.stopScraping();
    directPlaybackRef.current.reset();
  }, []);

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
    if (!isAnimeScrapeActive) {
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
    isAnimeScrapeActive,
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
    if (isAnimeScrapeActive) {
      const animeInput = buildAnimeScrapeInput();
      return animeInput ? animeScrapeMediaKeyFor(animeInput) : null;
    }

    const input = buildScrapeInput();
    return input ? scrapeMediaKeyFor(input) : null;
  }, [buildAnimeScrapeInput, buildScrapeInput, isAnimeScrapeActive]);

  const startScrapingForCurrentMedia = useCallback(() => {
    if (!isScrapeServer(selectedServer)) {
      return;
    }

    prefetchMoviPlayer();

    if (awaitingAnimeCoords) {
      return;
    }

    if (isDirectMode) {
      const input = buildScrapeInput();
      const mediaKey = input ? scrapeMediaKeyFor(input) : String(media.id);
      if (lastScrapeMediaKeyRef.current === mediaKey) {
        return;
      }

      animePlaybackScrapeRef.current.stopScraping();
      mediaScrapeRef.current.stopScraping();
      lastScrapeMediaKeyRef.current = mediaKey;
      void directPlaybackRef.current.loadStreams();
      return;
    }

    if (isAnimeScrapeActive) {
      const playbackInput = buildAnimePlaybackInput();
      if (!playbackInput) {
        return;
      }

      const mediaKey = animeScrapeMediaKeyFor(playbackInput.anime);
      if (lastScrapeMediaKeyRef.current === mediaKey) {
        return;
      }

      mediaScrapeRef.current.stopScraping();

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
    awaitingAnimeCoords,
    buildAnimePlaybackInput,
    buildScrapeInput,
    isAnimeScrapeActive,
    isDirectMode,
    media.id,
    selectedServer,
  ]);

  const stopScrapingPlayback = useCallback(() => {
    lastScrapeMediaKeyRef.current = null;
    if (isDirectMode && directPlayback.status !== "idle") {
      directPlaybackRef.current.reset();
      return;
    }
    if (activeScrape.status !== "idle") {
      stopScraping();
    }
  }, [activeScrape.status, directPlayback.status, isDirectMode, stopScraping]);

  const onPlaybackStart = useCallback(() => {
    scrapeFallbackHandledRef.current = null;
    startScrapingForCurrentMedia();
  }, [startScrapingForCurrentMedia]);

  const onPlaybackStop = useCallback(() => {
    scrapeFallbackHandledRef.current = null;
    stopScrapingPlayback();
  }, [stopScrapingPlayback]);

  const scrapeContextKey = getCurrentMediaKey() ?? "";

  scrapeFallbackContextRef.current = {
    isPlayingVideo,
    isDirectMode,
    noAdsMode,
    selectedServer,
    getCurrentMediaKey,
    getFallbackEmbedServer,
    setSelectedServer,
  };

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
    animeCoordsStatus,
    animeDirectOverride,
    isScrapeMode,
    movieScrapeOverride,
    scrapeContextKey,
    selectedServer.id,
    startScrapingForCurrentMedia,
    stopScrapingPlayback,
  ]);

  useEffect(() => {
    if (
      !isPlayingVideo ||
      !isAnimeScrapeActive ||
      !flags.directScrapeProviderAvailable
    ) {
      return;
    }

    if (animePlaybackScrape.status !== "scraping") {
      return;
    }

    const timeout = window.setTimeout(() => {
      if (animePlaybackScrapeRef.current.status !== "scraping") {
        return;
      }
      setAnimeDirectOverride(true);
      toast.message("Anime sources are slow — trying Direct.");
    }, 20_000);

    return () => window.clearTimeout(timeout);
  }, [
    animePlaybackScrape.status,
    flags.directScrapeProviderAvailable,
    isAnimeScrapeActive,
    isPlayingVideo,
    scrapeContextKey,
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
    if (isDirectMode) {
      directPlaybackRef.current.tryNextStream();
      return;
    }

    const scrape = isAnimeScrapeActive
      ? animePlaybackScrapeRef.current
      : mediaScrapeRef.current;

    if (!scrape.result?.providerId) {
      return;
    }

    if (isAnimeScrapeActive) {
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
  }, [
    buildAnimePlaybackInput,
    buildScrapeInput,
    isAnimeScrapeActive,
    isDirectMode,
  ]);

  const directPlaybackScrapeItems = useMemo(() => {
    if (!isDirectMode) {
      return null;
    }

    const itemStatus =
      directPlayback.status === "loading"
        ? ("pending" as const)
        : directPlayback.status === "playing"
          ? ("success" as const)
          : directPlayback.status === "error"
            ? ("failure" as const)
            : ("waiting" as const);

    return [
      {
        providerId: "direct",
        name: "Direct",
        status: itemStatus,
        error: directPlayback.error ?? undefined,
      },
    ];
  }, [directPlayback.error, directPlayback.status, isDirectMode]);

  const sourceOverlayItems = useMemo(
    () =>
      buildSourceOverlayItems({
        scrapeItems: directPlaybackScrapeItems ?? activeScrape.items,
        embedServers: videoServers,
        availableServerIds,
        unavailableServerIds,
      }),
    [
      activeScrape.items,
      availableServerIds,
      directPlaybackScrapeItems,
      unavailableServerIds,
    ],
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
      if (providerId === "direct" && flags.directScrapeProviderAvailable) {
        if (
          isDirectMode &&
          (directPlayback.status === "playing" ||
            directPlayback.status === "loading")
        ) {
          return;
        }

        setMovieScrapeOverride(null);
        if (isAnimeScrapeMode) {
          setAnimeDirectOverride(true);
        }
        preferredScrapeProviderIdRef.current = "direct";
        animePlaybackScrapeRef.current.stopScraping();
        mediaScrapeRef.current.stopScraping();
        lastScrapeMediaKeyRef.current = null;
        void directPlaybackRef.current.loadStreams();
        return;
      }

      if (!isAnimeScrapeActive && flags.directScrapeProviderAvailable) {
        setMovieScrapeOverride(providerId as ScrapeProviderId);
        preferredScrapeProviderIdRef.current = providerId;
        directPlaybackRef.current.reset();
        lastScrapeMediaKeyRef.current = null;

        const input = buildScrapeInput();
        if (!input) {
          return;
        }

        mediaScrapeRef.current.switchToProvider(
          input,
          providerId as ScrapeProviderId,
        );
        return;
      }

      const scrape = isAnimeScrapeActive
        ? animePlaybackScrapeRef.current
        : mediaScrapeRef.current;

      if (
        scrape.status === "playing" &&
        scrape.result?.providerId === providerId
      ) {
        return;
      }

      if (isAnimeScrapeActive) {
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
    [
      buildAnimePlaybackInput,
      buildScrapeInput,
      directPlayback.status,
      flags.directScrapeProviderAvailable,
      isAnimeScrapeActive,
      isAnimeScrapeMode,
      isDirectMode,
      resolvedMediaType,
    ],
  );

  const animePlaybackChainContext = useMemo(
    () => ({
      mappingConfidence,
      isAdultAnime,
      anilistGenres,
    }),
    [anilistGenres, isAdultAnime, mappingConfidence],
  );

  const scrapeProviderOptions = useMemo(() => {
    const base = filterProviderOptions(
      isAnimeScrapeMode
        ? buildGroupedAnimePlaybackProviderOptions(animePlaybackChainContext)
        : SCRAPE_PROVIDER_OPTIONS,
    );

    if (
      isAnimeScrapeMode &&
      flags.directScrapeProviderAvailable &&
      !base.some((option) => option.providerId === "direct")
    ) {
      return [
        {
          providerId: "direct" as AnimePlaybackScrapeProviderId,
          name: "Direct",
          group: "tmdb" as const,
        },
        ...base,
      ];
    }

    return base;
  }, [
    animePlaybackChainContext,
    filterProviderOptions,
    flags.directScrapeProviderAvailable,
    isAnimeScrapeMode,
  ]);

  const directPlaybackScrapeStatus =
    directPlayback.status === "loading"
      ? ("scraping" as const)
      : directPlayback.status === "playing"
        ? ("playing" as const)
        : directPlayback.status === "error"
          ? ("error" as const)
          : ("idle" as const);

  const canFindNextDirectStream =
    isDirectMode &&
    directPlayback.status === "playing" &&
    directPlayback.streamIndex < directPlayback.rankedStreams.length - 1;

  const canFindNextSource = (() => {
    if (canFindNextDirectStream) {
      return true;
    }

    if (
      !isScrapeMode ||
      activeScrape.status !== "playing" ||
      !activeScrape.result?.providerId
    ) {
      return false;
    }

    const providerOrder = filterProviderOrder(
      isAnimeScrapeActive
        ? buildAnimePlaybackProviderOrder(animePlaybackChainContext)
        : [...SCRAPE_PROVIDER_ORDER],
    );
    const currentIndex = providerOrder.indexOf(activeScrape.result.providerId);
    return currentIndex >= 0 && currentIndex < providerOrder.length - 1;
  })();

  const scrapeChrome = useMemo((): HeroScrapeChrome => {
    if (isDirectMode) {
      return {
        scrapeStatus: directPlaybackScrapeStatus,
        activeProviderId:
          directPlayback.status === "loading" ? "direct" : "direct",
        activeProviderName:
          directPlayback.status === "loading" ? "Direct" : "Direct",
        scrapeItems: directPlaybackScrapeItems ?? [],
        scrapeProviders: scrapeProviderOptions,
        onSelectScrapeProvider: handleSelectScrapeProvider,
        onFindNextSource: canFindNextDirectStream
          ? handleScrapedPlaybackError
          : null,
        canFindNextSource: canFindNextDirectStream,
      };
    }

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
    directPlayback.status,
    directPlaybackScrapeItems,
    directPlaybackScrapeStatus,
    canFindNextDirectStream,
    handleScrapedPlaybackError,
    handleSelectScrapeProvider,
    isDirectMode,
    isScrapeMode,
    scrapeProviderOptions,
  ]);

  const handleRetryAllScraping = useCallback(() => {
    scrapeFallbackHandledRef.current = null;
    lastScrapeMediaKeyRef.current = null;

    if (isDirectMode) {
      directPlaybackRef.current.retryAll();
      return;
    }

    if (isAnimeScrapeActive) {
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
  }, [
    buildAnimePlaybackInput,
    buildScrapeInput,
    isAnimeScrapeActive,
    isDirectMode,
  ]);

  const effectiveActiveScrape = useMemo(() => {
    if (!isDirectMode) {
      return activeScrape;
    }

    return {
      ...activeScrape,
      status: directPlaybackScrapeStatus,
      error: directPlayback.error,
      activeProviderId:
        directPlayback.status === "idle" ? null : ("direct" as const),
      result: null,
      items: directPlaybackScrapeItems ?? [],
    };
  }, [
    activeScrape,
    directPlayback.error,
    directPlayback.status,
    directPlaybackScrapeItems,
    directPlaybackScrapeStatus,
    isDirectMode,
  ]);

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
    isAnimeScrapeActive,
    isDirectMode,
    activeScrape: effectiveActiveScrape,
    directPlayback,
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
