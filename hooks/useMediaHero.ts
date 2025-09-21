"use client";

import type { YouTubePlayer } from "@/components/hero/youtube-types";
import { useEpisodeStore } from "@/lib/stores/episode-store";
import type { MediaItem } from "@/utils/typings";
import { LegacyAnimationControls, useAnimation } from "framer-motion";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  handleWatch: () => void;
  handlePlayTrailer: () => void;
  handleTrailerEnded: () => void;
  setYoutubePlayer: (player: YouTubePlayer) => void;
}

export interface UseMediaHeroOptions {
  media: MediaItem[];
  noSlide?: boolean;
  isWatch?: boolean;
  passedMediaType?: "tv" | "movie";
}

export interface UseMediaHeroReturn
  extends UseMediaHeroState,
    UseMediaHeroComputed,
    UseMediaHeroActions {}

export const useMediaHero = ({
  media,
  noSlide,
  isWatch = false,
  passedMediaType,
}: UseMediaHeroOptions): UseMediaHeroReturn => {
  const [currentItemIndex, setCurrentItemIndex] = useState<number>(0);
  const [isPlayingVideo, setIsPlayingVideo] = useState<boolean>(false);
  const [isPlayingTrailer, setIsPlayingTrailer] = useState<boolean>(false);
  const [youtubePlayer, setYoutubePlayer] = useState<YouTubePlayer>(null);
  const [historyLength, setHistoryLength] = useState<number>(2);
  const controls = useAnimation();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const handleNext = useCallback(() => {
    setCurrentItemIndex((prevIndex) =>
      prevIndex === media.length - 1 ? 0 : prevIndex + 1,
    );
    setIsPlayingVideo(false);
    setIsPlayingTrailer(false);
  }, [media.length]);

  useEffect(() => {
    const ref = timeoutRef.current;
    return () => {
      if (ref) clearTimeout(ref);
    };
  }, []);

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

  const handleWatch = useCallback(() => {
    setIsPlayingTrailer(false);
    setIsPlayingVideo(true);
  }, []);

  useEffect(() => {
    const shouldAutoplay = searchParams.get("autoplay") === "true";
    if (!shouldAutoplay || !isWatch) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const maybeAutoplay = async () => {
      if (passedMediaType === "tv" && currentItem) {
        const firstSeason = currentItem.seasons?.find(
          (s) => s.season_number > 0,
        );
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
                );
            }
          } catch {
            // we could log this, but failure shouldn't block autoplay
          }
        }
      }

      timer = setTimeout(() => {
        handleWatch();
        const params = new URLSearchParams(searchParams.toString());
        params.delete("autoplay");
        const newSearch = params.toString();
        router.replace(`${pathname}${newSearch ? `?${newSearch}` : ""}`, {
          scroll: false,
        });
      }, 500);
    };

    void maybeAutoplay();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [
    searchParams,
    isWatch,
    router,
    pathname,
    passedMediaType,
    currentItem,
    handleWatch,
  ]);

  const handlePlayTrailer = useCallback(() => {
    let currentItemVideos: { type: string; key: string }[] = [];
    if (currentItem?.videos) {
      if (Array.isArray(currentItem.videos)) {
        currentItemVideos = currentItem.videos as {
          type: string;
          key: string;
        }[];
      } else if (
        typeof currentItem.videos === "object" &&
        currentItem.videos !== null
      ) {
        const videosObj = currentItem.videos as { results?: unknown };
        if (Array.isArray(videosObj.results)) {
          currentItemVideos = videosObj.results as {
            type: string;
            key: string;
          }[];
        }
      }
    }
    const acceptableVideoTypes = ["Trailer", "Teaser", "Clip", "Featurette"];
    const trailerVideo = currentItemVideos.find((v) =>
      acceptableVideoTypes.includes(v.type),
    );

    if (!trailerVideo?.key) {
      console.log(
        "No trailer/teaser found. Available videos:",
        currentItemVideos,
      );
      return;
    }

    setIsPlayingTrailer(true);
  }, [currentItem]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setHistoryLength(window.history.length);
    }
  }, []);

  const mediaType = useMemo((): "tv" | "movie" | undefined => {
    if (passedMediaType) return passedMediaType;
    if (pathname.includes("/tvshows/")) return "tv";
    if (pathname.includes("/movies/")) return "movie";
    if (pathname.includes("/watch/")) {
      const currentMedia = media[currentItemIndex];
      if (currentMedia) {
        const isTvShow =
          currentMedia.media_type === "tv" ||
          currentMedia.name !== undefined ||
          currentMedia.first_air_date !== undefined ||
          currentMedia.number_of_seasons !== undefined ||
          currentMedia.number_of_episodes !== undefined;
        return isTvShow ? "tv" : "movie";
      }
    }
    return undefined;
  }, [passedMediaType, pathname, media, currentItemIndex]);

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
    handleTrailerEnded: () => setIsPlayingTrailer(false),
    setYoutubePlayer,
  };
};

export type UseMediaHero = typeof useMediaHero;
