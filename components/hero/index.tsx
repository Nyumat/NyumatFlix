"use client";

import { MediaItem } from "@/utils/typings";
import { useAnimation } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

import { useRouter } from "next/navigation";
import { HeroBackground } from "./hero-background";
import { HeroContent } from "./hero-content";
import { HeroPagination } from "./hero-pagination";
import { showToast } from "./toast-utils";
import { YouTubePlayer } from "./youtube-types";

interface MediaDetailHeroProps {
  media: MediaItem[];
  noSlide?: boolean;
  isWatch?: boolean;
  mediaType?: "tv" | "movie";
}

export function MediaDetailHero({
  media,
  noSlide,
  isWatch = false,
  mediaType: passedMediaType,
}: MediaDetailHeroProps) {
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  const [isPlayingTrailer, setIsPlayingTrailer] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controls = useAnimation();
  const [youtubePlayer, setYoutubePlayer] = useState<YouTubePlayer>(null);
  const router = useRouter();

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
      if (ref) {
        clearTimeout(ref);
      }
    };
  }, [timeoutRef]);

  useEffect(() => {
    if (!isPlayingVideo && !noSlide && !isWatch && !isPlayingTrailer) {
      const interval = setInterval(() => {
        handleNext();
      }, 7000);

      return () => {
        clearInterval(interval);
      };
    }
  }, [
    currentItemIndex,
    isPlayingVideo,
    noSlide,
    isWatch,
    isPlayingTrailer,
    handleNext,
  ]);

  const currentItem = media[currentItemIndex];

  const handleWatch = () => {
    setIsPlayingTrailer(false);
    setIsPlayingVideo(true);
  };

  const handleTrailerEnded = () => {
    setIsPlayingTrailer(false);
  };

  const handlePlayTrailer = () => {
    let currentItemVideos: { type: string; key: string }[] = [];

    if (currentItem.videos) {
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
        if (videosObj.results && Array.isArray(videosObj.results)) {
          currentItemVideos = videosObj.results as {
            type: string;
            key: string;
          }[];
        }
      }
    }

    const trailerKey = currentItemVideos.find(
      (video: { type: string }) => video.type === "Trailer",
    )?.key;

    if (!trailerKey) {
      showToast.error("No trailer available for this title");
      return;
    }

    setIsPlayingTrailer(true);
    showToast.info("Press X key or pause to stop trailer");
  };

  const isMoviesPath = window.location.pathname.includes("/movies/");
  const isTvShowsPath = window.location.pathname.includes("/tvshows/");

  const getRouteBasedMediaType = (): "tv" | "movie" | undefined => {
    if (passedMediaType) {
      return passedMediaType;
    }

    if (typeof window === "undefined") {
      // We need to have a fallback for SSR.
      return undefined;
    }

    const pathname = window.location.pathname;

    if (pathname.includes("/tvshows/")) {
      return "tv";
    } else if (pathname.includes("/movies/")) {
      return "movie";
    }

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
  };

  const mediaType = getRouteBasedMediaType();

  return (
    <div className={`relative ${isWatch ? "h-[75vh]" : "h-[82vh]"}`}>
      <Script
        src="https://www.youtube.com/iframe_api"
        strategy="lazyOnload"
        onLoad={() => {
          window.onYouTubeIframeAPIReady = () => {};
        }}
      />

      {isWatch && (
        <button
          title="Go back"
          disabled={window.history.length <= 2}
          aria-disabled={window.history.length <= 2}
          onClick={() => {
            if (isMoviesPath) router.push("/movies");
            if (isTvShowsPath) router.push("/tvshows");
            if (window.history.length > 2) window.history.back();
          }}
          className="absolute top-6 left-6 z-30 bg-background/80 hover:bg-background/90 backdrop-blur-sm transition-colors rounded-full p-2 text-foreground border border-border disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Go back"
        >
          <ChevronLeft size={24} />
        </button>
      )}

      <HeroBackground
        media={currentItem}
        mediaType={mediaType}
        isPlayingVideo={isPlayingVideo}
        isPlayingTrailer={isPlayingTrailer}
        controls={controls}
        onTrailerEnded={handleTrailerEnded}
        youtubePlayer={youtubePlayer}
        setYoutubePlayer={setYoutubePlayer}
      />

      <HeroContent
        media={currentItem}
        mediaType={mediaType}
        isWatch={isWatch}
        isPlayingVideo={isPlayingVideo}
        isPlayingTrailer={isPlayingTrailer}
        handleWatch={handleWatch}
        handlePlayTrailer={handlePlayTrailer}
      />

      {!noSlide && !isPlayingVideo && !isWatch && media.length > 1 && (
        <HeroPagination items={media} currentIndex={currentItemIndex} />
      )}
    </div>
  );
}
