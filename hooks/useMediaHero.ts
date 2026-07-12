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
import type { MediaItem } from "@/lib/domain/typings";
import { getFirstRegularSeason, isTVShow } from "@/lib/domain/typings";
import { LegacyAnimationControls, useAnimation } from "framer-motion";
import { stabilizeScrollTop } from "@/components/layout/route-scroll-reset";
import { usePathname, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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
  onPlaybackStart,
  onPlaybackStop,
}: UseMediaHeroOptions): UseMediaHeroReturn => {
  const [currentItemIndex, setCurrentItemIndex] = useState<number>(0);
  const [isPlayingVideo, setIsPlayingVideo] = useState<boolean>(false);
  const [isPlayingTrailer, setIsPlayingTrailer] = useState<boolean>(false);
  const [youtubePlayer, setYoutubePlayer] = useState<YouTubePlayer>(null);
  const [historyLength, setHistoryLength] = useState<number>(2);
  const controls = useAnimation();
  const gateAction = useAdblockGateAction();

  const searchParams = useSearchParams();
  const pathname = usePathname();
  const autoplayHandledRef = useRef(false);
  const disableHeroTrailers = useAppSettingsStore(
    (state) => state.disableHeroTrailers,
  );

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
    (mediaType === "movie" || mediaType === "tv") &&
    !isPlayingVideo &&
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

    let timer: ReturnType<typeof setTimeout> | null = null;
    let stabilize: { cancel: () => void } | null = null;
    let cancelled = false;

    const maybeAutoplay = async () => {
      if (passedMediaType === "tv" && currentItem) {
        const firstSeason = getFirstRegularSeason(currentItem);
        if (firstSeason) {
          try {
            const res = await fetch(
              `/api/tv/${currentItem.id}/season/${firstSeason.season_number}`,
            );
            const seasonData = await res.json();
            if (
              Array.isArray(seasonData.episodes) &&
              seasonData.episodes.length > 0
            ) {
              const firstEpisode = seasonData.episodes[0];
              useEpisodeStore
                .getState()
                .setSelectedEpisode(
                  firstEpisode,
                  currentItem.id.toString(),
                  firstSeason.season_number,
                  undefined,
                  false,
                  seasonData.episodes,
                );
            }
          } catch {
            void 0;
          }
        }
      }

      if (cancelled) return;

      timer = setTimeout(() => {
        if (cancelled) return;
        autoplayHandledRef.current = true;
        handleWatch({ skipAdblockCheck: true });
        const params = new URLSearchParams(searchParams.toString());
        params.delete("autoplay");
        const newSearch = params.toString();
        const nextUrl = `${pathname}${newSearch ? `?${newSearch}` : ""}`;
        window.history.replaceState(window.history.state, "", nextUrl);
        stabilize = stabilizeScrollTop();
      }, 500);
    };

    void maybeAutoplay();
    return () => {
      cancelled = true;
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

  useEffect(() => {
    if (typeof window !== "undefined") {
      setHistoryLength(window.history.length);
    }
  }, []);

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
