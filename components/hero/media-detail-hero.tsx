"use client";

import { WatchlistItem } from "@/lib/domain/watchlist";
import { Episode, MediaItem } from "@/lib/domain/typings";
import { useHeroScrapePlayback } from "@/hooks/use-hero-scrape-playback";
import { useMediaHero } from "@/hooks/useMediaHero";
import { useEpisodeStore } from "@/lib/stores/episode-store";
import Script from "next/script";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { HeroBackground } from "./hero-background";
import { ScrapeChromeProvider } from "./scrape-chrome-context";
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
}: MediaDetailHeroProps) {
  const [isAmbientMuted, setIsAmbientMuted] = useState(false);
  const [showAmbientAudioHint, setShowAmbientAudioHint] = useState(false);
  const [isHeroHovered, setIsHeroHovered] = useState(false);
  const [isAmbientBackdropActive, setIsAmbientBackdropActive] = useState(false);
  const [supportsExpandedHero, setSupportsExpandedHero] = useState(false);
  const hoverCollapseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const scrapePlaybackRef = useRef<ReturnType<
    typeof useHeroScrapePlayback
  > | null>(null);

  const notifyPlaybackStart = useCallback(() => {
    scrapePlaybackRef.current?.onPlaybackStart();
  }, []);

  const notifyPlaybackStop = useCallback(() => {
    scrapePlaybackRef.current?.onPlaybackStop();
  }, []);

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
  } = useMediaHero({
    media,
    noSlide,
    isWatch,
    passedMediaType,
    anilistId,
    onPlaybackStart: notifyPlaybackStart,
    onPlaybackStop: notifyPlaybackStop,
  });

  const heroMedia = (currentItem ?? media[0]) as MediaItem;

  const scrapePlayback = useHeroScrapePlayback({
    media: heroMedia,
    mediaType,
    isPlayingVideo,
  });
  scrapePlaybackRef.current = scrapePlayback;

  useLayoutEffect(() => {
    const contentIdStr = String(currentItem?.id ?? "");
    const storeState = useEpisodeStore.getState();

    if (mediaType !== "tv") {
      storeState.clearSelectedEpisode();
      return;
    }

    if (storeState.tvShowId && storeState.tvShowId !== contentIdStr) {
      storeState.clearSelectedEpisode();
    }
  }, [currentItem?.id, mediaType]);

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

  if (!currentItem) {
    return null;
  }

  return (
    <ScrapeChromeProvider chrome={scrapePlayback.scrapeChrome}>
      <div className="relative h-[100svh] min-h-[34rem] overflow-hidden bg-black">
        <Script
          src="https://www.youtube.com/iframe_api"
          strategy="lazyOnload"
        />

        <HeroBackground
          media={currentItem}
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
          scrapePlayback={scrapePlayback}
        />

        <HeroContent
          key={`${currentItem.id}-${mediaType ?? "unknown"}`}
          media={currentItem}
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
    </ScrapeChromeProvider>
  );
}
