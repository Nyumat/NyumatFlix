"use client";

import type { VideasyTrailerStreamStatus } from "@/hooks/use-videasy-trailer-stream";
import { useMediaVideosQuery } from "@/hooks/use-media-videos-query";
import type { useHeroScrapePlayback } from "@/hooks/use-hero-scrape-playback";
import { useVidsrcProgress } from "@/hooks/use-vidsrc-progress";
import {
  extractVideoRowsFromMediaVideos,
  selectPrimaryTrailerVideo,
  type TrailerPickRow,
} from "@/lib/select-primary-trailer-video";
import { useEpisodeStore } from "@/lib/stores/episode-store";
import { isScrapeServer, useServerStore } from "@/lib/stores/server-store";
import { logger } from "@/lib/utils";
import type { MediaItem } from "@/lib/domain/typings";
import {
  AnimatePresence,
  type LegacyAnimationControls,
  motion,
} from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { tmdbImage } from "@/tmdb/utils";
import { AmbientVideoBackdrop } from "./ambient-video-backdrop";
import {
  HeroEmbedPlayerPanel,
  HeroPlaybackShell,
  HeroScrapePlayerPanel,
} from "./hero-scrape-player-panel";
import { HERO_MEDIA_TRANSITION } from "./hero-overlay";
import {
  HERO_YOUTUBE_CHROMELESS_BASE,
  type YouTubePlayer,
} from "./youtube-types";

export type HeroScrapePlaybackState = ReturnType<typeof useHeroScrapePlayback>;

interface HeroBackgroundProps {
  media: MediaItem;
  mediaType?: "tv" | "movie";
  isPlayingVideo: boolean;
  isPlayingTrailer: boolean;
  controls: LegacyAnimationControls;
  onTrailerEnded(): void;
  youtubePlayer: YouTubePlayer;
  setYoutubePlayer(player: YouTubePlayer): void;
  anilistId?: number | null | undefined;
  videasyTrailerUrl: string | null;
  videasyTrailerHlsUrl: string | null;
  videasyTrailerStatus: VideasyTrailerStreamStatus;
  onVideasyStreamError(): void;
  isAmbientMuted: boolean;
  onAmbientAutoplayBlocked(): void;
  onAmbientBackdropActiveChange?(active: boolean): void;
  scrapePlayback: HeroScrapePlaybackState;
}

function sortTrailerVideos(rows: TrailerPickRow[]): TrailerPickRow[] {
  const primary = selectPrimaryTrailerVideo(rows);
  if (!primary) {
    return rows;
  }

  return [
    primary,
    ...rows.filter((video) => video.key !== primary.key),
  ] as TrailerPickRow[];
}

export function HeroBackground({
  media,
  mediaType,
  isPlayingVideo,
  isPlayingTrailer,
  controls,
  onTrailerEnded,
  youtubePlayer,
  setYoutubePlayer,
  anilistId,
  videasyTrailerUrl,
  videasyTrailerHlsUrl,
  videasyTrailerStatus,
  onVideasyStreamError,
  isAmbientMuted,
  onAmbientAutoplayBlocked,
  onAmbientBackdropActiveChange,
  scrapePlayback,
}: HeroBackgroundProps) {
  const { getEmbedUrl } = useEpisodeStore();
  const { selectedServer, vidnestContentType, animePreference } =
    useServerStore();

  const {
    resolvedMediaType,
    playbackTitle,
    buildPlaybackProgressKey,
    isAnimeScrapeMode,
    activeScrape,
    animeScrape,
    sourceOverlayItems,
    handleSelectEmbedServer,
    handleScrapedPlaybackError,
    handleScrapePlaybackEnded,
  } = scrapePlayback;

  useVidsrcProgress();

  const initialTrailerVideos = useMemo(() => {
    const rows = extractVideoRowsFromMediaVideos(media.videos).filter(
      (video) =>
        (!video.site || video.site === "YouTube") && Boolean(video.key),
    );
    return sortTrailerVideos(rows);
  }, [media.videos]);

  const trailerVideosQuery = useMediaVideosQuery(
    resolvedMediaType,
    media.id,
    initialTrailerVideos,
    isPlayingTrailer,
  );

  const trailerVideos = trailerVideosQuery.data ?? initialTrailerVideos;
  const [selectedTrailerIndex, setSelectedTrailerIndex] = useState(0);

  const hasVideasySource =
    videasyTrailerStatus === "ready" &&
    (Boolean(videasyTrailerUrl?.length) ||
      Boolean(videasyTrailerHlsUrl?.length));

  const videasyBackdropReady =
    hasVideasySource && !isPlayingTrailer && !isPlayingVideo;
  const selectedTrailer =
    trailerVideos[selectedTrailerIndex] ?? trailerVideos[0];
  const canSwitchTrailers = trailerVideos.length > 1;

  const playbackBackdropPath = media.backdrop_path ?? media.poster_path ?? null;
  const playbackBackdropUrl = playbackBackdropPath
    ? tmdbImage.backdrop(playbackBackdropPath, "w1280")
    : null;
  const playbackPosterUrl = playbackBackdropPath
    ? tmdbImage.backdrop(playbackBackdropPath, "w780")
    : null;

  const getVideoSrc = () => {
    const detectedMediaType = resolvedMediaType;

    if (selectedServer.id === "vidnest" && selectedServer.getVidnestUrl) {
      const episodeStore = useEpisodeStore.getState();

      if (vidnestContentType === "movie") {
        return selectedServer.getVidnestUrl(
          media.id,
          "movie",
          undefined,
          undefined,
          undefined,
        );
      }

      if (vidnestContentType === "tv") {
        if (episodeStore.selectedEpisode) {
          return selectedServer.getVidnestUrl(
            parseInt(episodeStore.tvShowId || ""),
            "tv",
            episodeStore.seasonNumber || undefined,
            episodeStore.providerEpisodeNumber ??
              episodeStore.selectedEpisode.episode_number,
            undefined,
          );
        }
        return selectedServer.getVidnestUrl(
          media.id,
          "tv",
          undefined,
          undefined,
          undefined,
        );
      }

      if (vidnestContentType === "anime") {
        if (
          episodeStore.isAnimeEpisode &&
          episodeStore.anilistId &&
          episodeStore.relativeEpisodeNumber
        ) {
          return selectedServer.getVidnestUrl(
            media.id,
            "anime",
            undefined,
            episodeStore.relativeEpisodeNumber,
            episodeStore.anilistId,
          );
        }

        const episode = episodeStore.selectedEpisode?.episode_number || 1;
        const idToUse = anilistId || media.id;
        return `https://vidnest.fun/anime/${idToUse}/${episode}/${animePreference}`;
      }

      if (vidnestContentType === "animepahe") {
        if (
          episodeStore.isAnimeEpisode &&
          episodeStore.anilistId &&
          episodeStore.relativeEpisodeNumber
        ) {
          return selectedServer.getVidnestUrl(
            media.id,
            "animepahe",
            undefined,
            episodeStore.relativeEpisodeNumber,
            episodeStore.anilistId,
          );
        }

        const episode = episodeStore.selectedEpisode?.episode_number || 1;
        const idToUse = anilistId || media.id;
        return `https://vidnest.fun/animepahe/${idToUse}/${episode}/${animePreference}`;
      }
    }

    if (detectedMediaType === "tv") {
      const episodeEmbedUrl = getEmbedUrl();
      if (episodeEmbedUrl) {
        return episodeEmbedUrl;
      }
      return "";
    }

    return selectedServer.getMovieUrl(media.id);
  };

  const embedVideoSrc = useMemo(
    () => getVideoSrc(),
    [
      animePreference,
      anilistId,
      getEmbedUrl,
      media.id,
      resolvedMediaType,
      selectedServer,
      vidnestContentType,
    ],
  );
  const embedIframeKey = `${embedVideoSrc}-${vidnestContentType}-${animePreference}-${selectedServer.id}`;
  const backdropSrc = `https://image.tmdb.org/t/p/original${
    media.backdrop_path ?? media.poster_path
  }`;
  const ambientVideoKey = hasVideasySource
    ? `${videasyTrailerUrl ?? ""}|${videasyTrailerHlsUrl ?? ""}`
    : String(media.backdrop_path ?? media.poster_path ?? media.id);

  useEffect(() => {
    setSelectedTrailerIndex(0);
  }, [media.id, trailerVideos]);

  useEffect(() => {
    if (!isPlayingTrailer || !selectedTrailer?.key) {
      if (youtubePlayer?.destroy) {
        youtubePlayer.destroy();
        setYoutubePlayer(null);
      }
      return;
    }

    let intervalId: number | null = null;
    let cancelled = false;

    const initPlayer = () => {
      if (cancelled || youtubePlayer || !window.YT?.Player) return;

      try {
        const player = new window.YT.Player("trailer-player", {
          videoId: selectedTrailer.key,
          playerVars: {
            ...HERO_YOUTUBE_CHROMELESS_BASE,
            autoplay: 1,
          },
          events: {
            onStateChange: (event: { data: number }) => {
              if (event.data === 0) {
                onTrailerEnded();
              }
            },
          },
        });
        setYoutubePlayer(player);
      } catch (error) {
        logger.error("Error initializing YouTube player", error);
      }
    };

    if (typeof window !== "undefined") {
      if (window.YT?.Player) {
        initPlayer();
      } else {
        intervalId = window.setInterval(() => {
          if (window.YT?.Player) {
            if (intervalId) {
              window.clearInterval(intervalId);
              intervalId = null;
            }
            initPlayer();
          }
        }, 200);
      }
    }

    return () => {
      cancelled = true;
      if (intervalId) {
        window.clearInterval(intervalId);
      }
      if (youtubePlayer?.destroy) {
        youtubePlayer.destroy();
        setYoutubePlayer(null);
      }
    };
  }, [
    isPlayingTrailer,
    selectedTrailer?.key,
    onTrailerEnded,
    youtubePlayer,
    setYoutubePlayer,
  ]);

  const switchTrailer = (direction: "next" | "previous") => {
    if (!canSwitchTrailers) return;
    if (youtubePlayer?.destroy) {
      youtubePlayer.destroy();
      setYoutubePlayer(null);
    }
    setSelectedTrailerIndex((current) => {
      const delta = direction === "next" ? 1 : -1;
      return (current + delta + trailerVideos.length) % trailerVideos.length;
    });
  };

  return (
    <div className="absolute inset-0 z-0 bg-black">
      <AnimatePresence mode="popLayout">
        <motion.div
          key={media.backdrop_path}
          className="relative h-full w-full"
          animate={controls}
        >
          {!isPlayingTrailer && !isPlayingVideo && !videasyBackdropReady && (
            <motion.img
              src={backdropSrc}
              fetchPriority="high"
              alt={(media.title || media.name) as string}
              className="w-full h-full object-cover absolute inset-0 z-0"
              initial={false}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={HERO_MEDIA_TRANSITION}
            />
          )}

          {videasyBackdropReady ? (
            <AmbientVideoBackdrop
              key={ambientVideoKey}
              ambientVideoKey={ambientVideoKey}
              backdropSrc={backdropSrc}
              backdropAlt={(media.title || media.name) as string}
              mp4Url={videasyTrailerUrl}
              hlsUrl={videasyTrailerHlsUrl}
              isMuted={isAmbientMuted}
              onAutoplayBlocked={onAmbientAutoplayBlocked}
              onStreamError={onVideasyStreamError}
              onBackdropActiveChange={onAmbientBackdropActiveChange}
            />
          ) : null}

          {isPlayingTrailer && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="w-full absolute z-30 px-4 sm:px-6 lg:px-8"
              style={{ top: "5rem", height: "calc(100% - 11rem)" }}
            >
              <div className="md:max-w-7xl lg:max-w-8xl mx-auto h-full">
                {selectedTrailer?.key ? (
                  <div className="relative h-full w-full rounded-lg border border-border/20 bg-black shadow-2xl">
                    <div
                      id="trailer-player"
                      key={selectedTrailer.key}
                      className="h-full w-full overflow-hidden rounded-lg"
                    />
                    {canSwitchTrailers ? (
                      <div className="absolute right-3 top-1/2 z-40 flex -translate-y-1/2 flex-col gap-2">
                        <button
                          type="button"
                          aria-label="Previous trailer"
                          onClick={() => switchTrailer("previous")}
                          className="flex size-10 items-center justify-center rounded-full border border-white/25 bg-black/55 text-white shadow-lg backdrop-blur-md transition hover:bg-black/75"
                        >
                          <ChevronUp className="size-5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          aria-label="Next trailer"
                          onClick={() => switchTrailer("next")}
                          className="flex size-10 items-center justify-center rounded-full border border-white/25 bg-black/55 text-white shadow-lg backdrop-blur-md transition hover:bg-black/75"
                        >
                          <ChevronDown className="size-5" aria-hidden />
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-lg border border-border/20 bg-black text-sm text-muted-foreground shadow-2xl">
                    Loading trailer...
                  </div>
                )}
              </div>
            </motion.div>
          )}
          {isPlayingVideo && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="w-full absolute z-30 px-4 sm:px-6 lg:px-8"
              style={{ top: "5rem", height: "calc(100% - 11rem)" }}
            >
              <div className="md:max-w-7xl lg:max-w-8xl mx-auto h-full relative">
                <HeroPlaybackShell
                  selectedServer={selectedServer}
                  scrapeStatus={activeScrape.status}
                  playbackBackdropUrl={playbackBackdropUrl}
                >
                  {isScrapeServer(selectedServer) ? (
                    <HeroScrapePlayerPanel
                      selectedServer={selectedServer}
                      scrapeStatus={activeScrape.status}
                      scrapeResult={activeScrape.result}
                      scrapeError={activeScrape.error}
                      activeProviderId={activeScrape.activeProviderId}
                      sourceOverlayItems={sourceOverlayItems}
                      playbackTitle={playbackTitle}
                      playbackPosterUrl={playbackPosterUrl}
                      progressKey={buildPlaybackProgressKey()}
                      streamKind={
                        isAnimeScrapeMode && animeScrape.result?.streamKind
                          ? animeScrape.result.streamKind
                          : "hls"
                      }
                      isTv={resolvedMediaType === "tv"}
                      onSelectEmbedServer={handleSelectEmbedServer}
                      onFatalError={handleScrapedPlaybackError}
                      onEnded={handleScrapePlaybackEnded}
                    />
                  ) : (
                    <HeroEmbedPlayerPanel
                      videoSrc={embedVideoSrc}
                      iframeKey={embedIframeKey}
                    />
                  )}
                </HeroPlaybackShell>
              </div>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
