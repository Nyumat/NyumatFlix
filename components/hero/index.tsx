"use client";

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
  anilistId?: number | null | undefined;
}

export function MediaDetailHero({
  media,
  noSlide,
  isWatch = false,
  mediaType: passedMediaType,
  isUpcoming = false,
  anilistId,
}: MediaDetailHeroProps) {
  const {
    currentItemIndex,
    isPlayingVideo,
    isPlayingTrailer,
    youtubePlayer,
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

      <HeroBackground
        media={currentItem as MediaItem}
        mediaType={mediaType}
        isPlayingVideo={isPlayingVideo}
        isPlayingTrailer={isPlayingTrailer}
        controls={controls}
        onTrailerEnded={handleTrailerEnded}
        youtubePlayer={youtubePlayer}
        setYoutubePlayer={setYoutubePlayer}
        anilistId={anilistId}
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
        handleTrailerEnded={handleTrailerEnded}
        youtubePlayer={youtubePlayer}
        setYoutubePlayer={setYoutubePlayer}
        isUpcoming={isUpcoming}
      />

      {!noSlide && !isPlayingVideo && !isWatch && media.length > 1 && (
        <HeroPagination items={media} currentIndex={currentItemIndex} />
      )}
    </div>
  );
}
