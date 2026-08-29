"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useFeatureFlags } from "@/components/providers/feature-flags-provider";
import { useTvDetailCatalog } from "@/hooks/use-tv-detail-catalog";
import {
  getAnimePlaybackProviderOrders,
  getTmdbScrapeProviderMenuOrder,
  isAnimeScrapeProviderEnabled,
  isTmdbScrapeProviderEnabled,
} from "@/lib/flags/site-flags";
import { prefetchDirectPlaybackPlayer } from "@/lib/direct/prefetch-playback-player";
import { prefetchDirectStreamDiscovery } from "@/lib/direct/stream-discovery-cache";
import type { HeroScrapeChrome } from "@/components/hero/hero-scrape-types";
import { flushPlaybackProgress } from "@/lib/playback/progress-flush";
import { useAnimePlaybackScrape } from "@/hooks/use-anime-playback-scrape";
import { useDirectPlayback } from "@/hooks/use-direct-movie-playback";
import { useScrape } from "@/hooks/use-scrape";
import { useServerAvailabilityQuery } from "@/hooks/use-server-availability-query";
import { detectMediaType } from "@/lib/media/detect-media-type";
import { normalizeTvContentKey } from "@/lib/tv-watch-target";
import {
  excludeDirectScrapeProvider,
  isDirectPlaybackEligible,
  resolveTvPlaybackTmdbId,
} from "@/lib/tv-playback-tmdb-id";
import { formatPlaybackTitle } from "@/lib/playback/playback-title";
import type { PlaybackProgressKey } from "@/lib/playback/progress-storage";
import {
  buildAnimePlaybackProviderOrder,
  buildGroupedAnimePlaybackProviderOptions,
  shouldIncludeTmdbPlaybackProxies,
  withManualDirectMenuOption,
} from "@/lib/providers/anime-playback-chain";
import { type AnimePlaybackScrapeProviderId } from "@/lib/providers/registry";
import type { ScrapeProviderId } from "@/lib/scrape/types";
import { animeScrapeMediaKeyFor } from "@/lib/scrape/anime/types";
import { buildSourceOverlayItems } from "@/lib/scrape/source-overlay";
import {
  SCRAPE_PROVIDER_OPTIONS,
  scrapeMediaKeyFor,
  type ScrapeMediaInput,
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
import {
  tvCompleteMediaFromRecord,
  type ContinueWatchingCompleteMedia,
} from "@/lib/playback/continue-watching-complete";
import { usePlaybackCompleteActions } from "@/hooks/use-playback-complete-actions";
import { postWatchProgressIfSignedIn } from "@/lib/watchlist/post-watch-progress";

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
    anilistGenres: episodeAnilistGenres,
    defaultAnilistId,
    animeCoordsStatus,
    playbackTmdbTvId,
    advanceToNextEpisode,
  } = useEpisodeStore();
  const {
    selectedServer,
    setSelectedServer,
    getFallbackEmbedServer,
    availableServerIds,
    unavailableServerIds,
  } = useServerStore();
  const noAdsMode = useAppSettingsStore((state) => state.noAdsMode);
  const playbackAudio = useAppSettingsStore((state) => state.playbackAudio);
  const flags = useFeatureFlags();
  const tvDetailCatalog = useTvDetailCatalog();
  const animePlaybackProviderOrders = useMemo(
    () => getAnimePlaybackProviderOrders(flags),
    [flags],
  );
  const tmdbScrapeProviderOrder = useMemo(
    () => getTmdbScrapeProviderMenuOrder(flags),
    [flags],
  );

  const filterProviderOptions = useCallback(
    <T extends { providerId: string; group?: "anime" | "tmdb" }>(
      options: readonly T[],
    ): T[] =>
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
    usesDirectPlayback: false,
    mappingConfidence: null as "high" | "low" | null,
  });
  const usesDirectPlaybackRef = useRef(false);

  const onAllDirectStreamsFailed = useCallback(() => {
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

    scrapeFallbackHandledRef.current = mediaKey;
    ctx.setSelectedServer(ctx.getFallbackEmbedServer());
    toast.error("No sources found, switching select fallback.");
  }, [noAdsMode]);

  const onAllProvidersFailed = useCallback(() => {
    const ctx = scrapeFallbackContextRef.current;
    if (
      !ctx.isPlayingVideo ||
      !isScrapeServer(ctx.selectedServer) ||
      ctx.noAdsMode ||
      ctx.isDirectMode
    ) {
      return;
    }

    const mediaKey = ctx.getCurrentMediaKey();
    if (!mediaKey || scrapeFallbackHandledRef.current === mediaKey) {
      return;
    }

    const {
      isAnimeScrapeMode: animeMode,
      directAvailable,
      usesDirectPlayback: onDirect,
      mappingConfidence: fallbackMappingConfidence,
    } = animeDirectFallbackRef.current;
    if (animeMode && directAvailable && !onDirect) {
      scrapeFallbackHandledRef.current = mediaKey;
      setScrapeProviderPreference("direct");
      animePlaybackScrapeRef.current.stopScraping();
      lastScrapeMediaKeyRef.current = null;
      void directPlaybackRef.current.loadStreams();
      toast.message(
        fallbackMappingConfidence === "low"
          ? "Anime sources unavailable — trying Direct. Episode numbering may not match."
          : "Anime sources unavailable — trying Direct.",
      );
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
  const [scrapeProviderPreference, setScrapeProviderPreference] = useState<
    string | null
  >(null);
  const isPlayingVideoRef = useRef(isPlayingVideo);
  isPlayingVideoRef.current = isPlayingVideo;
  const isScrapeMode = isScrapeServer(selectedServer);

  const isAnimeScrapeMode =
    isAnimeEpisode &&
    typeof episodeAnilistId === "number" &&
    episodeAnilistId > 0 &&
    typeof relativeEpisodeNumber === "number" &&
    relativeEpisodeNumber > 0;

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

  const completeMedia = useMemo((): ContinueWatchingCompleteMedia | null => {
    if (resolvedMediaType === "movie") {
      return { mediaType: "movie" };
    }
    if (resolvedMediaType !== "tv") {
      return null;
    }
    return tvCompleteMediaFromRecord(media as Record<string, unknown>);
  }, [media, resolvedMediaType]);

  const resolvedAnilistId =
    typeof episodeAnilistId === "number" && episodeAnilistId > 0
      ? episodeAnilistId
      : defaultAnilistId;

  const { applyPlaybackComplete } = usePlaybackCompleteActions({
    contentId: media.id,
    mediaType: resolvedMediaType,
    anilistId: resolvedAnilistId,
    completeMedia,
  });

  const resolvedTmdbTvId = useMemo(() => {
    if (resolvedMediaType !== "tv") {
      return null;
    }

    return (
      resolveTvPlaybackTmdbId(tvShowId, media, tvDetailCatalog) ??
      playbackTmdbTvId
    );
  }, [media, playbackTmdbTvId, resolvedMediaType, tvDetailCatalog, tvShowId]);

  const directTmdbId = useMemo(() => {
    if (resolvedMediaType === "movie") {
      return Number.isInteger(media.id) && media.id > 0 ? media.id : null;
    }

    return resolvedTmdbTvId;
  }, [media.id, resolvedMediaType, resolvedTmdbTvId]);

  const directPlaybackEligible = useMemo(
    () =>
      isDirectPlaybackEligible({
        directScrapeProviderAvailable: flags.directScrapeProviderAvailable,
        mediaType: resolvedMediaType,
        mediaId: media.id,
        isAdultAnime,
        resolvedTmdbTvId,
      }),
    [
      flags.directScrapeProviderAvailable,
      isAdultAnime,
      media.id,
      resolvedMediaType,
      resolvedTmdbTvId,
    ],
  );

  const anilistGenres = useMemo(() => {
    if (episodeAnilistGenres.length > 0) {
      return episodeAnilistGenres;
    }

    return "genres" in media && Array.isArray(media.genres)
      ? media.genres
          .map((genre) => genre.name)
          .filter((name): name is string => Boolean(name))
      : [];
  }, [episodeAnilistGenres, media]);

  const animePlaybackChainContext = useMemo(
    () => ({
      mappingConfidence,
      isAdultAnime,
      anilistGenres,
    }),
    [anilistGenres, isAdultAnime, mappingConfidence],
  );

  const directIsOnlyScrapeProvider = useMemo(() => {
    if (!flags.directScrapeProviderAvailable) {
      return false;
    }
    if (flags.proxyModeOnly) {
      return true;
    }

    const base = isAnimeScrapeMode
      ? withManualDirectMenuOption(
          filterProviderOptions(
            buildGroupedAnimePlaybackProviderOptions(
              animePlaybackChainContext,
              animePlaybackProviderOrders,
            ),
          ),
          flags.directScrapeProviderAvailable,
        )
      : filterProviderOptions(SCRAPE_PROVIDER_OPTIONS);

    return base.every((option) => option.providerId === "direct");
  }, [
    animePlaybackChainContext,
    animePlaybackProviderOrders,
    filterProviderOptions,
    flags.directScrapeProviderAvailable,
    flags.proxyModeOnly,
    isAnimeScrapeMode,
  ]);

  const hasEnabledAnimeScrapeProviders = useMemo(() => {
    if (!isAnimeScrapeMode) {
      return false;
    }
    const grouped = buildGroupedAnimePlaybackProviderOptions(
      animePlaybackChainContext,
      animePlaybackProviderOrders,
    );
    return grouped.some(
      (option) =>
        option.group === "anime" &&
        isAnimeScrapeProviderEnabled(flags, option.providerId),
    );
  }, [
    animePlaybackChainContext,
    animePlaybackProviderOrders,
    flags,
    isAnimeScrapeMode,
  ]);

  const usesDirectPlayback = useMemo(() => {
    if (!isScrapeMode || !flags.directScrapeProviderAvailable) {
      return false;
    }
    if (!directPlaybackEligible) {
      return false;
    }
    if (movieScrapeOverride !== null) {
      return false;
    }
    if (scrapeProviderPreference === "direct") {
      return true;
    }
    if (
      scrapeProviderPreference !== null &&
      scrapeProviderPreference !== "direct"
    ) {
      return false;
    }
    return flags.proxyModeOnly || directIsOnlyScrapeProvider;
  }, [
    directIsOnlyScrapeProvider,
    directPlaybackEligible,
    flags.directScrapeProviderAvailable,
    flags.proxyModeOnly,
    isScrapeMode,
    movieScrapeOverride,
    scrapeProviderPreference,
  ]);

  const isDirectMode =
    isScrapeMode && flags.directScrapeProviderAvailable && usesDirectPlayback;

  const isAnimeScrapeActive =
    isAnimeScrapeMode && !usesDirectPlayback && hasEnabledAnimeScrapeProviders;

  const directPlayback = useDirectPlayback({
    tmdbId: directTmdbId ?? 0,
    mediaType: resolvedMediaType,
    seasonNumber: seasonNumber || undefined,
    episodeNumber:
      providerEpisodeNumber ?? selectedEpisode?.episode_number ?? undefined,
    enabled: isDirectMode && directTmdbId !== null,
    onAllStreamsFailed: onAllDirectStreamsFailed,
  });

  const directPlaybackRef = useRef(directPlayback);
  directPlaybackRef.current = directPlayback;

  useEffect(() => {
    setMovieScrapeOverride(null);
    setScrapeProviderPreference(null);
    lastScrapeMediaKeyRef.current = null;
  }, [
    media.id,
    resolvedMediaType,
    seasonNumber,
    selectedEpisode?.episode_number,
  ]);

  usesDirectPlaybackRef.current = usesDirectPlayback;
  animeDirectFallbackRef.current = {
    isAnimeScrapeMode,
    directAvailable:
      flags.directScrapeProviderAvailable && directPlaybackEligible,
    usesDirectPlayback,
    mappingConfidence,
  };

  // Known anime show, but TMDB→AniList episode coords still loading — don't
  // flash the TMDB provider list in the scrape overlay.
  const awaitingAnimeCoords =
    Boolean(defaultAnilistId) &&
    Boolean(selectedEpisode) &&
    mappingConfidence !== "high" &&
    !isDirectMode &&
    !isAnimeScrapeActive;

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
      const contentId = isTv
        ? tvShowId
          ? normalizeTvContentKey(tvShowId)
          : normalizeTvContentKey(media.id)
        : media.id;

      if (contentId === null || contentId <= 0) {
        return null;
      }

      return {
        mediaType: resolvedMediaType,
        contentId,
        seasonNumber: isTv ? seasonNumber || undefined : undefined,
        episodeNumber: isTv
          ? selectedEpisode?.episode_number || undefined
          : undefined,
        anilistId: isTv ? (episodeAnilistId ?? defaultAnilistId) : null,
      };
    }, [
      defaultAnilistId,
      episodeAnilistId,
      media.id,
      resolvedMediaType,
      seasonNumber,
      selectedEpisode?.episode_number,
      tvShowId,
    ]);

  const buildScrapeInput = useCallback((): ScrapeMediaInput | null => {
    const isTv = resolvedMediaType === "tv";
    const tmdbId =
      isTv && resolvedTmdbTvId ? resolvedTmdbTvId : !isTv ? media.id : null;

    if (!Number.isInteger(tmdbId) || !tmdbId || tmdbId <= 0) {
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
    resolvedTmdbTvId,
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
      translationType: playbackAudio,
      query: String(media.title || media.name || "").trim() || undefined,
    };
  }, [
    playbackAudio,
    episodeAnilistId,
    isAnimeScrapeActive,
    media.name,
    media.title,
    relativeEpisodeNumber,
  ]);

  const buildAnimePlaybackInput = useCallback(() => {
    const animeInput = buildAnimeScrapeInput();
    if (!animeInput) {
      return null;
    }

    const chain = {
      mappingConfidence,
      isAdultAnime,
      anilistGenres,
      translationType: playbackAudio,
    };
    const tmdbInput = buildScrapeInput();

    if (!tmdbInput && !shouldIncludeTmdbPlaybackProxies(chain)) {
      return {
        anime: animeInput,
        tmdb: null,
        chain,
      };
    }

    if (!tmdbInput) {
      return null;
    }

    return {
      anime: animeInput,
      tmdb: tmdbInput,
      chain,
    };
  }, [
    anilistGenres,
    buildAnimeScrapeInput,
    buildScrapeInput,
    isAdultAnime,
    mappingConfidence,
    playbackAudio,
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

    prefetchDirectPlaybackPlayer();

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
      if (mappingConfidence !== "high") {
        return;
      }

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
      animePlaybackScrapeRef.current.startScraping(playbackInput);
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
    awaitingAnimeCoords,
    buildAnimePlaybackInput,
    buildScrapeInput,
    isAnimeScrapeActive,
    isDirectMode,
    mappingConfidence,
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
    isScrapeMode,
    movieScrapeOverride,
    scrapeContextKey,
    scrapeProviderPreference,
    selectedServer.id,
    startScrapingForCurrentMedia,
    stopScrapingPlayback,
    usesDirectPlayback,
  ]);

  useEffect(() => {
    if (!isScrapeMode || !usesDirectPlayback) {
      return;
    }

    prefetchDirectPlaybackPlayer();
  }, [isScrapeMode, usesDirectPlayback]);

  // Warm stream discovery as soon as the hero mounts in direct mode so the
  // results are already cached when the user presses Play.
  useEffect(() => {
    if (!isDirectMode || directTmdbId === null) {
      return;
    }
    const episode =
      providerEpisodeNumber ?? selectedEpisode?.episode_number ?? 0;
    return prefetchDirectStreamDiscovery(
      resolvedMediaType === "tv"
        ? {
            mediaType: "tv",
            tmdbId: directTmdbId,
            season: seasonNumber ?? 0,
            episode,
          }
        : { mediaType: "movie", tmdbId: directTmdbId },
    );
  }, [
    directTmdbId,
    isDirectMode,
    providerEpisodeNumber,
    resolvedMediaType,
    seasonNumber,
    selectedEpisode?.episode_number,
  ]);

  const serverAvailabilityInput =
    useMemo((): ServerAvailabilityInput | null => {
      const isTv = resolvedMediaType === "tv";
      const tmdbId = isTv
        ? (resolvedTmdbTvId ??
          (tvShowId
            ? normalizeTvContentKey(tvShowId)
            : normalizeTvContentKey(media.id)))
        : media.id;

      if (tmdbId === null || tmdbId <= 0) {
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
        animePreference: playbackAudio,
        isAdultAnime: isAnimeEpisode && isAdultAnime,
      };
    }, [
      playbackAudio,
      episodeAnilistId,
      isAnimeEpisode,
      media.id,
      providerEpisodeNumber,
      relativeEpisodeNumber,
      resolvedTmdbTvId,
      seasonNumber,
      selectedEpisode?.episode_number,
      tvShowId,
      isAdultAnime,
    ]);

  useServerAvailabilityQuery(serverAvailabilityInput);

  const handleScrapedPlaybackError = useCallback(() => {
    if (isDirectMode) {
      flushPlaybackProgress();
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

  const handleDirectPlaybackExhausted = useCallback(() => {
    directPlaybackRef.current.handlePlaybackExhausted();
  }, []);

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
        if (!directPlaybackEligible || directTmdbId === null) {
          return;
        }

        if (
          isDirectMode &&
          (directPlayback.status === "playing" ||
            directPlayback.status === "loading")
        ) {
          return;
        }

        setMovieScrapeOverride(null);
        setScrapeProviderPreference("direct");
        preferredScrapeProviderIdRef.current = "direct";
        animePlaybackScrapeRef.current.stopScraping();
        mediaScrapeRef.current.stopScraping();
        lastScrapeMediaKeyRef.current = null;
        void directPlaybackRef.current.loadStreams();
        return;
      }

      if (!isAnimeScrapeActive && flags.directScrapeProviderAvailable) {
        setMovieScrapeOverride(providerId as ScrapeProviderId);
        setScrapeProviderPreference(providerId);
        preferredScrapeProviderIdRef.current = providerId;
        directPlaybackRef.current.reset();

        const input = buildScrapeInput();
        if (!input) {
          return;
        }

        lastScrapeMediaKeyRef.current = scrapeMediaKeyFor(input);
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

        lastScrapeMediaKeyRef.current = animeScrapeMediaKeyFor(
          playbackInput.anime,
        );
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

      lastScrapeMediaKeyRef.current = scrapeMediaKeyFor(input);
      mediaScrapeRef.current.switchToProvider(
        input,
        providerId as ScrapeProviderId,
      );
    },
    [
      buildAnimePlaybackInput,
      buildScrapeInput,
      directPlaybackEligible,
      directPlayback.status,
      directTmdbId,
      flags.directScrapeProviderAvailable,
      isAnimeScrapeActive,
      isAnimeScrapeMode,
      isDirectMode,
      resolvedMediaType,
    ],
  );

  const scrapeProviderOptions = useMemo(() => {
    if (!isAnimeScrapeMode) {
      return excludeDirectScrapeProvider(
        filterProviderOptions(SCRAPE_PROVIDER_OPTIONS),
        directPlaybackEligible,
      );
    }

    return excludeDirectScrapeProvider(
      withManualDirectMenuOption(
        filterProviderOptions(
          buildGroupedAnimePlaybackProviderOptions(
            animePlaybackChainContext,
            animePlaybackProviderOrders,
          ),
        ),
        flags.directScrapeProviderAvailable && directPlaybackEligible,
      ),
      directPlaybackEligible,
    );
  }, [
    animePlaybackChainContext,
    animePlaybackProviderOrders,
    directPlaybackEligible,
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
    isDirectMode && directPlayback.status === "playing";

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
        ? buildAnimePlaybackProviderOrder(
            animePlaybackChainContext,
            animePlaybackProviderOrders,
          )
        : ([...tmdbScrapeProviderOrder] as ScrapeProviderId[]),
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
        findNextSourceLabel: "Try different stream",
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
      onSelectScrapeProvider: handleSelectScrapeProvider,
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

    const progressKey = buildPlaybackProgressKey();
    if (
      progressKey &&
      progressKey.seasonNumber != null &&
      progressKey.episodeNumber != null
    ) {
      await postWatchProgressIfSignedIn({
        contentId: progressKey.contentId,
        mediaType: "tv",
        seasonNumber: progressKey.seasonNumber,
        episodeNumber: progressKey.episodeNumber,
        anilistId: progressKey.anilistId,
        episodeCompleted: true,
      }).catch((error) => {
        console.error("Failed to mark episode complete on watchlist", error);
      });
    }

    const advanced = await advanceToNextEpisode();
    if (advanced) {
      const nextKey = buildPlaybackProgressKey();
      if (
        nextKey &&
        nextKey.seasonNumber != null &&
        nextKey.episodeNumber != null
      ) {
        void postWatchProgressIfSignedIn({
          contentId: nextKey.contentId,
          mediaType: "tv",
          seasonNumber: nextKey.seasonNumber,
          episodeNumber: nextKey.episodeNumber,
          anilistId: nextKey.anilistId,
        }).catch((error) => {
          console.error("Failed to update continue-watching episode", error);
        });
      }
    }
    if (advanced && isPlayingVideo && isScrapeMode) {
      lastScrapeMediaKeyRef.current = null;
      startScrapingForCurrentMedia();
    } else if (!advanced) {
      await applyPlaybackComplete();
    }
    return advanced;
  }, [
    advanceToNextEpisode,
    applyPlaybackComplete,
    buildPlaybackProgressKey,
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
    handleDirectPlaybackExhausted,
    handleRetryAllScraping,
    handleScrapePlaybackEnded,
  };
}
