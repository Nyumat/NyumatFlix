"use client";

import type { YouTubePlayer } from "@/components/hero/youtube-types";
import type { VideasyTrailerStreamStatus } from "@/hooks/use-videasy-trailer-stream";
import { useVideasyTrailerStream } from "@/hooks/use-videasy-trailer-stream";
import { useAdblockGateAction } from "@/components/providers/adblock-gate-provider";
import {
  extractVideoRowsFromMediaVideos,
  selectPrimaryTrailerKey,
} from "@/lib/select-primary-trailer-video";
import { useEpisodeStore } from "@/lib/stores/episode-store";
import { useAppSettingsStore } from "@/lib/stores/app-settings-store";
import { useFeatureFlags } from "@/components/providers/feature-flags-provider";
import type { Episode, MediaItem } from "@/lib/domain/typings";
import { isTVShow } from "@/lib/domain/typings";
import { LegacyAnimationControls, useAnimation } from "framer-motion";
import { stabilizeScrollTop } from "@/components/layout/route-scroll-reset";
import { withPageTvApiPath } from "@/lib/tv-detail-catalog";
import { usePathname, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { WatchlistItem } from "@/lib/domain/watchlist";
import { useLocalTvWatchCoords } from "@/hooks/use-local-tv-watch-coords";
import {
  hasTvAutoplayEligibility,
  type LocalTvWatchCoords,
} from "@/lib/tv-watch-target";

const readImdbIdFromMediaItem = (
  item: MediaItem | undefined,
): string | undefined => {
  if (!item) {
    return undefined;
  }
  const fromExternal = (item as { external_ids?: { imdb_id?: string } })
    .external_ids?.imdb_id;
  if (typeof fromExternal === "string" && fromExternal.startsWith("tt")) {
    return fromExternal;
  }
  const fromRoot = (item as { imdb_id?: string }).imdb_id;
  if (typeof fromRoot === "string" && fromRoot.startsWith("tt")) {
    return fromRoot;
  }
  return undefined;
};

export interface UseMediaHeroState {
  currentItemIndex: number;
  isPlayingVideo: boolean;
  isPlayingTrailer: boolean;
  youtubePlayer: YouTubePlayer;
  historyLength: number;
}

export interface UseMediaHeroComputed {
  currentItem: MediaItem | undefined;
  controls: LegacyAnimationControls;
  mediaType: "tv" | "movie" | undefined;
}

export interface UseMediaHeroActions {
  handleNext: () => void;
  handleWatch: (options?: { skipAdblockCheck?: boolean }) => void;
  handlePlayTrailer: () => void;
  handleTrailerEnded: () => void;
  setYoutubePlayer: (player: YouTubePlayer) => void;
}

export interface UseMediaHeroOptions {
  media: MediaItem[];
  noSlide?: boolean;
  isWatch?: boolean;
  passedMediaType?: "tv" | "movie";
  anilistId?: number | null | undefined;
  watchlistItem?: WatchlistItem | null;
  watchlistResolved?: boolean;
  onPlaybackStart?: () => void;
  onPlaybackStop?: () => void;
}

export interface UseMediaHeroReturn
  extends UseMediaHeroState,
    UseMediaHeroComputed,
    UseMediaHeroActions {
  videasyTrailerUrl: string | null;
  videasyTrailerHlsUrl: string | null;
  videasyTrailerStatus: VideasyTrailerStreamStatus;
  handleVideasyStreamError: () => void;
  canPlayTrailer: boolean;
}

export const useMediaHero = ({
  media,
  noSlide,
  isWatch = false,
  passedMediaType,
  anilistId,
  watchlistItem,
  watchlistResolved = true,
  onPlaybackStart,
  onPlaybackStop,
}: UseMediaHeroOptions): UseMediaHeroReturn => {
  const [currentItemIndex, setCurrentItemIndex] = useState<number>(0);
  const [isPlayingVideo, setIsPlayingVideo] = useState<boolean>(false);
  const [isPlayingTrailer, setIsPlayingTrailer] = useState<boolean>(false);
  const [isActiveHeroSlide, setIsActiveHeroSlide] = useState<boolean>(true);
  const [youtubePlayer, setYoutubePlayer] = useState<YouTubePlayer>(null);
  const historyLength =
    typeof window !== "undefined" ? window.history.length : 2;
  const controls = useAnimation();
  const gateAction = useAdblockGateAction();

  const searchParams = useSearchParams();
  const pathname = usePathname();
  const autoplayHandledRef = useRef(false);
  const disableHeroTrailers = useAppSettingsStore(
    (state) => state.disableHeroTrailers,
  );
  const featureFlags = useFeatureFlags();

  useEffect(() => {
    autoplayHandledRef.current = false;
  }, [pathname]);

  const handleNext = useCallback(() => {
    setCurrentItemIndex((prevIndex) =>
      prevIndex === media.length - 1 ? 0 : prevIndex + 1,
    );
    onPlaybackStop?.();
    setIsPlayingVideo(false);
    setIsPlayingTrailer(false);
  }, [media.length, onPlaybackStop]);

  useEffect(() => {
    if (!isPlayingVideo && !noSlide && !isWatch && !isPlayingTrailer) {
      const interval = setInterval(() => {
        handleNext();
      }, 7000);
      return () => clearInterval(interval);
    }
  }, [isPlayingVideo, noSlide, isWatch, isPlayingTrailer, handleNext]);

  const currentItem = useMemo(
    () => media[currentItemIndex],
    [media, currentItemIndex],
  );
  const localTvCoords = useLocalTvWatchCoords(currentItem?.id ?? 0);

  useEffect(() => {
    if (noSlide || isWatch) {
      setIsActiveHeroSlide(true);
      return;
    }

    setIsActiveHeroSlide(false);
    const timer = window.setTimeout(() => {
      setIsActiveHeroSlide(true);
    }, 800);

    return () => window.clearTimeout(timer);
  }, [currentItemIndex, isWatch, noSlide]);

  const imdbId = useMemo(
    () => readImdbIdFromMediaItem(currentItem),
    [currentItem],
  );

  const mediaType = useMemo((): "tv" | "movie" | undefined => {
    if (passedMediaType) return passedMediaType;
    if (pathname.includes("/tvshows/")) return "tv";
    if (pathname.includes("/movies/")) return "movie";
    if (pathname.includes("/watch/")) {
      const currentMedia = media[currentItemIndex];
      if (currentMedia) {
        return isTVShow(currentMedia) ? "tv" : "movie";
      }
    }
    return undefined;
  }, [passedMediaType, pathname, media, currentItemIndex]);

  const videasyEnabled =
    !disableHeroTrailers &&
    !featureFlags.staticHeroBackdrops &&
    (mediaType === "movie" || mediaType === "tv") &&
    !isPlayingVideo &&
    isActiveHeroSlide &&
    Boolean(imdbId);

  const {
    mp4Url: videasyTrailerUrl,
    hlsUrl: videasyTrailerHlsUrl,
    status: videasyTrailerStatus,
    handleStreamError: handleVideasyStreamError,
  } = useVideasyTrailerStream(imdbId, videasyEnabled);

  const startPlayback = useCallback(() => {
    setIsPlayingTrailer(false);
    setIsPlayingVideo(true);
    onPlaybackStart?.();
  }, [onPlaybackStart]);

  const handleWatch = useCallback(
    (options?: { skipAdblockCheck?: boolean }) => {
      if (options?.skipAdblockCheck) {
        startPlayback();
        return;
      }

      gateAction(startPlayback);
    },
    [gateAction, startPlayback],
  );

  useLayoutEffect(() => {
    if (searchParams.get("autoplay") !== "true" || !isWatch) return;
    const stabilize = stabilizeScrollTop();
    return () => stabilize.cancel();
  }, [searchParams, isWatch]);

  useEffect(() => {
    const shouldAutoplay = searchParams.get("autoplay") === "true";
    if (!shouldAutoplay || !isWatch || autoplayHandledRef.current) return;
    if (!watchlistResolved) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let stabilize: { cancel: () => void } | null = null;
    let cancelled = false;

    let seasonAbort: AbortController | null = null;

    const stripAutoplayParam = () => {
      autoplayHandledRef.current = true;
      const params = new URLSearchParams(searchParams.toString());
      params.delete("autoplay");
      const newSearch = params.toString();
      const nextUrl = `${pathname}${newSearch ? `?${newSearch}` : ""}`;
      window.history.replaceState(window.history.state, "", nextUrl);
    };

    const maybeAutoplay = async () => {
      const isTvAutoplay = passedMediaType === "tv" && currentItem;
      const tvLocalCoords: LocalTvWatchCoords | null =
        currentItem && localTvCoords ? localTvCoords : null;

      if (
        isTvAutoplay &&
        !hasTvAutoplayEligibility(watchlistItem, tvLocalCoords)
      ) {
        stripAutoplayParam();
        return;
      }

      if (isTvAutoplay) {
        seasonAbort = new AbortController();
        try {
          const progressSeason =
            watchlistItem?.lastWatchedSeason ?? tvLocalCoords?.seasonNumber ?? null;
          const progressEpisode =
            watchlistItem?.lastWatchedEpisode ??
            tvLocalCoords?.episodeNumber ??
            null;
          const nextEpisodePath = withPageTvApiPath(
            `/api/tv/${currentItem.id}/next-episode`,
            pathname,
          );
          const nextEpisodeUrl = new URL(nextEpisodePath, window.location.origin);
          if (progressSeason != null) {
            nextEpisodeUrl.searchParams.set(
              "lastWatchedSeason",
              String(progressSeason),
            );
          }
          if (progressEpisode != null) {
            nextEpisodeUrl.searchParams.set(
              "lastWatchedEpisode",
              String(progressEpisode),
            );
          }
          const nextEpisodeRes = await fetch(nextEpisodeUrl.toString(), {
            signal: seasonAbort.signal,
          });
          if (!nextEpisodeRes.ok) {
            return;
          }

          const nextEpisodeData = (await nextEpisodeRes.json()) as {
            episodeInfo?: {
              nextUnwatchedEpisode?: {
                seasonNumber: number;
                episodeNumber: number;
              } | null;
            } | null;
          };

          if (cancelled) {
            return;
          }

          const nextCoords =
            nextEpisodeData.episodeInfo?.nextUnwatchedEpisode ?? null;
          if (!nextCoords) {
            return;
          }

          const seasonPath = withPageTvApiPath(
            `/api/tv/${currentItem.id}/season/${nextCoords.seasonNumber}`,
            pathname,
          );
          const seasonRes = await fetch(seasonPath, {
            signal: seasonAbort.signal,
          });
          if (!seasonRes.ok) {
            return;
          }

          const seasonData = (await seasonRes.json()) as {
            episodes?: Episode[];
          };
          if (cancelled) {
            return;
          }

          if (
            !Array.isArray(seasonData.episodes) ||
            seasonData.episodes.length === 0
          ) {
            return;
          }

          const selectedEpisode =
            seasonData.episodes.find(
              (episode) => episode.episode_number === nextCoords.episodeNumber,
            ) ?? seasonData.episodes[0];

          if (!selectedEpisode) {
            return;
          }

          useEpisodeStore
            .getState()
            .setSelectedEpisode(
              selectedEpisode,
              currentItem.id.toString(),
              nextCoords.seasonNumber,
              undefined,
              false,
              seasonData.episodes,
            );
        } catch {
          void 0;
        }
      }

      if (cancelled) return;

      timer = setTimeout(() => {
        if (cancelled) return;
        autoplayHandledRef.current = true;
        handleWatch({ skipAdblockCheck: true });
        stripAutoplayParam();
        stabilize = stabilizeScrollTop();
      }, 500);
    };

    void maybeAutoplay();
    return () => {
      cancelled = true;
      seasonAbort?.abort();
      if (timer) clearTimeout(timer);
      stabilize?.cancel();
    };
  }, [
    searchParams,
    isWatch,
    pathname,
    passedMediaType,
    currentItem,
    anilistId,
    handleWatch,
    watchlistItem,
    watchlistResolved,
    localTvCoords,
  ]);

  const handlePlayTrailer = useCallback(() => {
    const rows = extractVideoRowsFromMediaVideos(currentItem?.videos);
    const ytKey = selectPrimaryTrailerKey(rows);
    const hasVideasy =
      videasyTrailerStatus === "ready" &&
      (Boolean(videasyTrailerUrl?.length) ||
        Boolean(videasyTrailerHlsUrl?.length));
    if (!ytKey && !hasVideasy) {
      return;
    }

    setIsPlayingTrailer(true);
  }, [
    currentItem,
    videasyTrailerHlsUrl,
    videasyTrailerStatus,
    videasyTrailerUrl,
  ]);

  const handleTrailerEnded = useCallback(() => {
    onPlaybackStop?.();
    setIsPlayingTrailer(false);
    setIsPlayingVideo(false);
  }, [onPlaybackStop]);

  const canPlayTrailer = useMemo(() => {
    const rows = extractVideoRowsFromMediaVideos(currentItem?.videos);
    if (selectPrimaryTrailerKey(rows)) {
      return true;
    }
    return (
      videasyTrailerStatus === "ready" &&
      (Boolean(videasyTrailerUrl?.length) ||
        Boolean(videasyTrailerHlsUrl?.length))
    );
  }, [
    currentItem,
    videasyTrailerHlsUrl,
    videasyTrailerStatus,
    videasyTrailerUrl,
  ]);

  return {
    currentItemIndex,
    isPlayingVideo,
    isPlayingTrailer,
    youtubePlayer,
    historyLength,
    currentItem,
    controls,
    mediaType,
    handleNext,
    handleWatch,
    handlePlayTrailer,
    handleTrailerEnded,
    setYoutubePlayer,
    videasyTrailerUrl,
    videasyTrailerHlsUrl,
    videasyTrailerStatus,
    handleVideasyStreamError,
    canPlayTrailer,
  };
};

export type UseMediaHero = typeof useMediaHero;
