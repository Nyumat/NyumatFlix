"use client";

import { MediaItem } from "@/utils/typings";
import { useAnimation } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

import { useEpisodeStore } from "@/lib/stores/episode-store";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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

  // Check for autoplay parameter
  useEffect(() => {
    const shouldAutoplay = searchParams.get("autoplay") === "true";
    if (shouldAutoplay && isWatch) {
      // For TV shows, we need to select the first episode
      if (passedMediaType === "tv" && currentItem) {
        // Get first season number (skip season 0 which is usually specials)
        const firstSeason = currentItem.seasons?.find(
          (season) => season.season_number > 0,
        );
        if (firstSeason) {
          // Fetch and select first episode
          fetch(`/api/tv/${currentItem.id}/season/${firstSeason.season_number}`)
            .then((res) => res.json())
            .then((seasonData) => {
              if (seasonData.episodes?.length > 0) {
                const firstEpisode = seasonData.episodes[0];
                useEpisodeStore
                  .getState()
                  .setSelectedEpisode(
                    firstEpisode,
                    currentItem.id.toString(),
                    firstSeason.season_number,
                  );
              }
            })
            .catch(console.error);
        }
      }

      // Small delay to ensure everything is loaded
      const timer = setTimeout(() => {
        handleWatch();

        // Remove autoplay param from URL without reload
        const params = new URLSearchParams(searchParams.toString());
        params.delete("autoplay");
        const newSearch = params.toString();
        router.replace(`${pathname}${newSearch ? `?${newSearch}` : ""}`, {
          scroll: false,
        });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [searchParams, isWatch, router, pathname, passedMediaType, currentItem]);

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

  const isMoviesPath = pathname.includes("/movies/");
  const isTvShowsPath = pathname.includes("/tvshows/");

  const getRouteBasedMediaType = (): "tv" | "movie" | undefined => {
    if (passedMediaType) {
      return passedMediaType;
    }

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

  const [historyLength, setHistoryLength] = useState(2);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setHistoryLength(window.history.length);
    }
  }, []);

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
          disabled={historyLength <= 2}
          aria-disabled={historyLength <= 2}
          onClick={() => {
            if (isMoviesPath) router.push("/movies");
            if (isTvShowsPath) router.push("/tvshows");
            if (historyLength > 2) window.history.back();
          }}
          onMouseEnter={() => {
            if (isMoviesPath) router.prefetch("/movies");
            if (isTvShowsPath) router.prefetch("/tvshows");
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
