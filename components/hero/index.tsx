"use client";

import { ChevronLeft } from "lucide-react";
import Script from "next/script";
import { useMediaHero } from "../../hooks/useMediaHero";
import { MediaItem } from "../../utils/typings";
import { HeroBackground } from "./hero-background";
import { HeroContent } from "./hero-content";
import { HeroPagination } from "./hero-pagination";
import { showToast } from "./toast-utils";

interface MediaDetailHeroProps {
  media: MediaItem[];
  noSlide?: boolean;
  isWatch?: boolean;
  mediaType?: "tv" | "movie";
  isUpcoming?: boolean;
}

export function MediaDetailHero({
  media,
  noSlide,
  isWatch = false,
  mediaType: passedMediaType,
  isUpcoming = false,
}: MediaDetailHeroProps) {
  const {
    currentItemIndex,
    isPlayingVideo,
    isPlayingTrailer,
    youtubePlayer,
    historyLength,
    currentItem,
    controls,
    mediaType,
    handleWatch,
    handlePlayTrailer,
    handleTrailerEnded,
    setYoutubePlayer,
  } = useMediaHero({ media, noSlide, isWatch, passedMediaType });

  return (
    <div className={`relative ${isWatch ? "h-[75vh]" : "h-[82vh]"}`}>
      <Script src="https://www.youtube.com/iframe_api" strategy="lazyOnload" />
      {isWatch && (
        <button
          title="Go back"
          disabled={historyLength <= 2}
          aria-disabled={historyLength <= 2}
          onClick={() => {
            // i mean we could optionally route to listing pages based on context
            if (historyLength > 2) window.history.back();
          }}
          onMouseEnter={() => {
            // possible prefetching opportunity?
          }}
          className="absolute top-6 left-6 z-30 bg-background/80 hover:bg-background/90 backdrop-blur-sm transition-colors rounded-full p-2 text-foreground border border-border disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Go back"
        >
          <ChevronLeft size={24} />
        </button>
      )}

      <HeroBackground
        media={currentItem as MediaItem}
        mediaType={mediaType}
        isPlayingVideo={isPlayingVideo}
        isPlayingTrailer={isPlayingTrailer}
        controls={controls}
        onTrailerEnded={handleTrailerEnded}
        youtubePlayer={youtubePlayer}
        setYoutubePlayer={setYoutubePlayer}
      />

      <HeroContent
        media={currentItem as MediaItem}
        mediaType={mediaType}
        isWatch={isWatch}
        isPlayingVideo={isPlayingVideo}
        isPlayingTrailer={isPlayingTrailer}
        handleWatch={handleWatch}
        handlePlayTrailer={() => {
          const before = isPlayingTrailer;
          handlePlayTrailer();
          if (!before) {
            showToast.info("Press X key or pause to stop trailer");
          }
        }}
        isUpcoming={isUpcoming}
      />

      {!noSlide && !isPlayingVideo && !isWatch && media.length > 1 && (
        <HeroPagination items={media} currentIndex={currentItemIndex} />
      )}
    </div>
  );
}
