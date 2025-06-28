"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { MediaItem } from "@/utils/typings";
import { useAnimation } from "framer-motion";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import Script from "next/script";

import { HeroBackground } from "./hero-background";
import { HeroContent } from "./hero-content";
import { HeroPagination } from "./hero-pagination";
import { YouTubePlayer } from "./youtube-types";
import { showToast } from "./toast-utils";

interface HeroSectionProps {
  media: MediaItem[];
  noSlide?: boolean;
  isWatch?: boolean;
}

export function HeroSection({
  media,
  noSlide,
  isWatch = false,
}: HeroSectionProps) {
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  const [isPlayingTrailer, setIsPlayingTrailer] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controls = useAnimation();
  const [youtubePlayer, setYoutubePlayer] = useState<YouTubePlayer>(null);

  const handleNext = useCallback(() => {
    setCurrentItemIndex((prevIndex) =>
      prevIndex === media.length - 1 ? 0 : prevIndex + 1,
    );
    setIsPlayingVideo(false);
    setIsPlayingTrailer(false);
  }, [media.length]);

  // Clear timeout on unmount
  useEffect(() => {
    const ref = timeoutRef.current;
    return () => {
      if (ref) {
        clearTimeout(ref);
      }
    };
  }, [timeoutRef]);

  // Auto-advance slide if not playing video
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
    // Find trailer if available
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

    // If no trailer is available, show a toast and don't transition the UI
    if (!trailerKey) {
      showToast.error("No trailer available for this title");
      return;
    }

    // If trailer exists, proceed with playing it
    setIsPlayingTrailer(true);
    showToast.info("Press X key or pause to stop trailer");
  };

  // Determine media type (movie or TV show)
  const mediaType = currentItem && "title" in currentItem ? "movie" : "tv";

  return (
    <div className={`relative ${isWatch ? "h-[75vh]" : "h-[82vh]"}`}>
      {/* YouTube API script */}
      <Script
        src="https://www.youtube.com/iframe_api"
        strategy="lazyOnload"
        onLoad={() => {
          // YouTube API is loaded and ready to use
          window.onYouTubeIframeAPIReady = () => {
            // console.log("YouTube API ready");
          };
        }}
      />

      {isWatch && (
        <Link href={mediaType === "movie" ? "/movies" : "/tvshows"}>
          <button
            className="absolute top-6 left-6 z-30 bg-black/50 hover:bg-black/70 transition-colors rounded-full p-2 text-white"
            aria-label="Go back"
          >
            <ChevronLeft size={24} />
          </button>
        </Link>
      )}

      <HeroBackground
        media={currentItem}
        isPlayingVideo={isPlayingVideo}
        isPlayingTrailer={isPlayingTrailer}
        controls={controls}
        onTrailerEnded={handleTrailerEnded}
        youtubePlayer={youtubePlayer}
        setYoutubePlayer={setYoutubePlayer}
      />

      <HeroContent
        media={currentItem}
        isWatch={isWatch}
        isPlayingVideo={isPlayingVideo}
        isPlayingTrailer={isPlayingTrailer}
        handleWatch={handleWatch}
        handlePlayTrailer={handlePlayTrailer}
      />

      {!noSlide && !isPlayingVideo && !isWatch && media.length > 1 && (
        <HeroPagination media={media} currentItemIndex={currentItemIndex} />
      )}
    </div>
  );
}
