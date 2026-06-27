"use client";

import { WatchlistItem } from "@/lib/domain/watchlist";
import { Episode, MediaItem } from "@/lib/domain/typings";
import { useMediaHero } from "@/hooks/useMediaHero";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { HeroBackground } from "./hero-background";
import { HeroContent } from "./hero-content";
import { HeroMediaOverlay } from "./hero-overlay";
import { HeroPagination } from "./hero-static";
import type { TvHeroEpisodeData } from "./types";

interface MediaDetailHeroProps {
  media: MediaItem[];
  noSlide?: boolean;
  isWatch?: boolean;
  mediaType?: "tv" | "movie";
  isUpcoming?: boolean;
  anilistId?: number | null | undefined;
  watchlistItem?: WatchlistItem | null;
  initialEpisode?: Episode | null;
  initialSeasonNumber?: number | null;
  tvHeroEpisodeData?: TvHeroEpisodeData | null;
}

export function MediaDetailHero({
  media,
  noSlide,
  isWatch = false,
  mediaType: passedMediaType,
  isUpcoming = false,
  anilistId,
  watchlistItem,
  initialEpisode,
  initialSeasonNumber,
  tvHeroEpisodeData,
}: MediaDetailHeroProps) {
  const [isAmbientMuted, setIsAmbientMuted] = useState(false);
  const [showAmbientAudioHint, setShowAmbientAudioHint] = useState(false);
  const [isHeroHovered, setIsHeroHovered] = useState(false);
  const [isAmbientBackdropActive, setIsAmbientBackdropActive] = useState(false);
  const [supportsExpandedHero, setSupportsExpandedHero] = useState(false);
  const hoverCollapseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    if (!showAmbientAudioHint) {
      return;
    }
    const timeout = window.setTimeout(() => {
      setShowAmbientAudioHint(false);
    }, 7000);
    return () => window.clearTimeout(timeout);
  }, [showAmbientAudioHint]);

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
    videasyTrailerUrl,
    videasyTrailerHlsUrl,
    videasyTrailerStatus,
    handleVideasyStreamError,
    canPlayTrailer,
  } = useMediaHero({ media, noSlide, isWatch, passedMediaType, anilistId });

  const hasVideasyAmbientSource =
    videasyTrailerStatus === "ready" &&
    (Boolean(videasyTrailerUrl?.length) ||
      Boolean(videasyTrailerHlsUrl?.length));
  const showAmbientMuteButton =
    !isPlayingTrailer && !isPlayingVideo && hasVideasyAmbientSource;

  useEffect(() => {
    if (!showAmbientMuteButton) {
      setShowAmbientAudioHint(false);
    }
  }, [showAmbientMuteButton]);

  const handleDetailsMouseEnter = () => {
    if (hoverCollapseTimeoutRef.current) {
      clearTimeout(hoverCollapseTimeoutRef.current);
      hoverCollapseTimeoutRef.current = null;
    }
    setIsHeroHovered(true);
  };

  const handleDetailsMouseLeave = () => {
    if (hoverCollapseTimeoutRef.current) {
      clearTimeout(hoverCollapseTimeoutRef.current);
    }
    hoverCollapseTimeoutRef.current = setTimeout(() => {
      setIsHeroHovered(false);
      hoverCollapseTimeoutRef.current = null;
    }, 3000);
  };

  useEffect(() => {
    const heroExpansionQuery = window.matchMedia("(min-width: 768px)");
    const syncHeroExpansionSupport = () => {
      setSupportsExpandedHero(heroExpansionQuery.matches);
      if (!heroExpansionQuery.matches) {
        setIsHeroHovered(false);
      }
    };

    syncHeroExpansionSupport();
    heroExpansionQuery.addEventListener("change", syncHeroExpansionSupport);

    return () => {
      if (hoverCollapseTimeoutRef.current) {
        clearTimeout(hoverCollapseTimeoutRef.current);
      }
      heroExpansionQuery.removeEventListener(
        "change",
        syncHeroExpansionSupport,
      );
    };
  }, []);

  return (
    <div className="relative h-[100svh] min-h-[34rem] overflow-hidden">
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
        videasyTrailerUrl={videasyTrailerUrl}
        videasyTrailerHlsUrl={videasyTrailerHlsUrl}
        videasyTrailerStatus={videasyTrailerStatus}
        onVideasyStreamError={handleVideasyStreamError}
        isAmbientMuted={isAmbientMuted}
        onAmbientAutoplayBlocked={() => {
          if (!hasVideasyAmbientSource) {
            return;
          }
          setIsAmbientMuted(true);
          setShowAmbientAudioHint(true);
        }}
        onAmbientBackdropActiveChange={setIsAmbientBackdropActive}
      />

      <HeroContent
        media={currentItem as MediaItem}
        mediaType={mediaType}
        isWatch={isWatch}
        isPlayingVideo={isPlayingVideo}
        isPlayingTrailer={isPlayingTrailer}
        handleWatch={handleWatch}
        handlePlayTrailer={handlePlayTrailer}
        handleTrailerEnded={handleTrailerEnded}
        youtubePlayer={youtubePlayer}
        setYoutubePlayer={setYoutubePlayer}
        isUpcoming={isUpcoming}
        watchlistItem={watchlistItem}
        initialEpisode={initialEpisode}
        initialSeasonNumber={initialSeasonNumber}
        anilistId={anilistId}
        canPlayTrailer={canPlayTrailer}
        showAmbientMuteButton={showAmbientMuteButton}
        showAmbientAudioHint={showAmbientMuteButton && showAmbientAudioHint}
        isAmbientMuted={isAmbientMuted}
        isHeroHovered={supportsExpandedHero && isHeroHovered}
        onDetailsMouseEnter={handleDetailsMouseEnter}
        onDetailsMouseLeave={handleDetailsMouseLeave}
        onToggleAmbientMute={() => {
          setShowAmbientAudioHint(false);
          setIsAmbientMuted((prev) => !prev);
        }}
      />

      {!isPlayingVideo && !isPlayingTrailer ? (
        <HeroMediaOverlay isAmbientBackdropActive={isAmbientBackdropActive} />
      ) : null}

      {!noSlide && !isPlayingVideo && !isWatch && media.length > 1 && (
        <HeroPagination items={media} currentIndex={currentItemIndex} />
      )}
    </div>
  );
}
