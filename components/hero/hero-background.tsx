"use client";

import type { VideasyTrailerStreamStatus } from "@/hooks/use-videasy-trailer-stream";
import {
  extractVideoRowsFromMediaVideos,
  selectPrimaryTrailerVideo,
  type TrailerPickRow,
} from "@/lib/select-primary-trailer-video";
import { useEpisodeStore } from "@/lib/stores/episode-store";
import { useServerStore } from "@/lib/stores/server-store";
import { logger } from "@/lib/utils";
import type { MediaItem } from "@/lib/domain/typings";
import {
  AnimatePresence,
  type LegacyAnimationControls,
  motion,
} from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { VideasyStreamVideo } from "./videasy-stream-video";
import { HERO_AMBIENT_VIDEO_MASK, HERO_MEDIA_TRANSITION } from "./hero-overlay";
import {
  HERO_YOUTUBE_CHROMELESS_BASE,
  type YouTubePlayer,
} from "./youtube-types";

/**
 * Props for the HeroBackground component
 */
interface HeroBackgroundProps {
  /** Media item to display in the background */
  media: MediaItem;
  /** Media type from route (tv or movie) */
  mediaType?: "tv" | "movie";
  /** Whether a video is currently playing */
  isPlayingVideo: boolean;
  /** Whether a trailer is currently playing */
  isPlayingTrailer: boolean;
  /** Animation controls for the background */
  controls: LegacyAnimationControls;
  /** Callback function when trailer ends */
  onTrailerEnded(): void;
  /** YouTube player instance */
  youtubePlayer: YouTubePlayer;
  /** Setter for YouTube player instance */
  setYoutubePlayer(player: YouTubePlayer): void;
  /** Anilist ID for anime content */
  anilistId?: number | null | undefined;
  videasyTrailerUrl: string | null;
  videasyTrailerHlsUrl: string | null;
  videasyTrailerStatus: VideasyTrailerStreamStatus;
  onVideasyStreamError(): void;
  isAmbientMuted: boolean;
  onAmbientAutoplayBlocked(): void;
  onAmbientBackdropActiveChange?(active: boolean): void;
}

/**
 * HeroBackground component manages the background display for hero sections
 * Handles background images, video playback, and YouTube trailer integration
 * @param props - The component props
 * @returns A dynamic background component with video and image support
 */
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
}: HeroBackgroundProps) {
  const { getEmbedUrl } = useEpisodeStore();
  const { selectedServer, vidnestContentType, animePreference } =
    useServerStore();
  const initialTrailerVideos = useMemo(() => {
    const rows = extractVideoRowsFromMediaVideos(media.videos).filter(
      (video) =>
        (!video.site || video.site === "YouTube") && Boolean(video.key),
    );
    const primary = selectPrimaryTrailerVideo(rows);
    if (!primary) return rows;
    return [
      primary,
      ...rows.filter((video) => video.key !== primary.key),
    ] as TrailerPickRow[];
  }, [media.videos]);
  const [trailerVideos, setTrailerVideos] =
    useState<TrailerPickRow[]>(initialTrailerVideos);
  const [selectedTrailerIndex, setSelectedTrailerIndex] = useState(0);
  const hasVideasySource =
    videasyTrailerStatus === "ready" &&
    (Boolean(videasyTrailerUrl?.length) ||
      Boolean(videasyTrailerHlsUrl?.length));

  const videasyBackdropReady =
    hasVideasySource && !isPlayingTrailer && !isPlayingVideo;
  const selectedTrailer =
    trailerVideos[selectedTrailerIndex] ?? initialTrailerVideos[0];
  const canSwitchTrailers = trailerVideos.length > 1;

  const getMediaType = (): "movie" | "tv" => {
    if (mediaType) {
      return mediaType;
    }

    if (media) {
      // I found that checking for a 'name' property is a reliable way to identify a TV show.
      // a 'first_air_date' is also a good indicator, as are season and episode counts.
      const isTvShow =
        media.media_type === "tv" ||
        media.name !== undefined ||
        media.first_air_date !== undefined ||
        media.number_of_seasons !== undefined ||
        media.number_of_episodes !== undefined;

      if (isTvShow) {
        return "tv";
      }
    }

    if (typeof window !== "undefined") {
      if (window.location.pathname.includes("/tvshows/")) {
        return "tv";
      } else if (window.location.pathname.includes("/movies/")) {
        return "movie";
      }
    }

    return "movie";
  };

  const getVideoSrc = () => {
    const detectedMediaType = getMediaType();

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
        } else {
          // For non-anime content with anime content type, use anilistId if available, otherwise construct URL manually
          const episode = episodeStore.selectedEpisode?.episode_number || 1;
          const idToUse = anilistId || media.id;
          return `https://vidnest.fun/anime/${idToUse}/${episode}/${animePreference}`;
        }
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
        } else {
          // For non-anime content with animepahe content type, use anilistId if available, otherwise construct URL manually
          const episode = episodeStore.selectedEpisode?.episode_number || 1;
          const idToUse = anilistId || media.id;
          return `https://vidnest.fun/animepahe/${idToUse}/${episode}/${animePreference}`;
        }
      }
    }

    // For TV shows, use episode URLs (which now includes anime URLs)
    if (detectedMediaType === "tv") {
      const episodeEmbedUrl = getEmbedUrl();
      if (episodeEmbedUrl) {
        return episodeEmbedUrl;
      }
      return "";
    }

    // For movies, use movie URL
    return selectedServer.getMovieUrl(media.id);
  };

  const [isAmbientVideoReady, setIsAmbientVideoReady] = useState(false);
  const backdropSrc = `https://image.tmdb.org/t/p/original${
    media.backdrop_path ?? media.poster_path
  }`;
  const ambientVideoKey = hasVideasySource
    ? `${videasyTrailerUrl ?? ""}|${videasyTrailerHlsUrl ?? ""}`
    : media.backdrop_path;
  const shouldShowAmbientVideo = videasyBackdropReady;

  useEffect(() => {
    setTrailerVideos(initialTrailerVideos);
    setSelectedTrailerIndex(0);
  }, [initialTrailerVideos]);

  useEffect(() => {
    setIsAmbientVideoReady(false);
  }, [ambientVideoKey, media.backdrop_path, media.poster_path]);

  useEffect(() => {
    onAmbientBackdropActiveChange?.(
      shouldShowAmbientVideo && isAmbientVideoReady,
    );
  }, [
    isAmbientVideoReady,
    onAmbientBackdropActiveChange,
    shouldShowAmbientVideo,
  ]);

  useEffect(() => {
    if (!isPlayingTrailer) return;

    let cancelled = false;
    const loadVideos = async () => {
      try {
        const response = await fetch(
          `/api/media/${getMediaType()}/${media.id}/videos`,
        );
        if (!response.ok) return;
        const data: unknown = await response.json();
        if (cancelled) return;
        const rows = extractVideoRowsFromMediaVideos(data).filter(
          (video) =>
            (!video.site || video.site === "YouTube") && Boolean(video.key),
        );
        const primary = selectPrimaryTrailerVideo(rows);
        const sorted = primary
          ? [primary, ...rows.filter((video) => video.key !== primary.key)]
          : rows;
        if (sorted.length > 0) {
          setTrailerVideos(sorted);
          setSelectedTrailerIndex(0);
        }
      } catch {
        // Keep the videos already embedded in the media payload.
      }
    };

    void loadVideos();
    return () => {
      cancelled = true;
    };
  }, [isPlayingTrailer, media.id]);

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
    <div className="absolute inset-0 z-0">
      <AnimatePresence mode="popLayout">
        <motion.div
          key={media.backdrop_path}
          className="relative h-full w-full"
          animate={controls}
        >
          {!isPlayingTrailer && !isPlayingVideo && (
            <motion.img
              src={backdropSrc}
              fetchPriority="high"
              alt={(media.title || media.name) as string}
              className="w-full h-full object-cover absolute inset-0 z-0"
              initial={{ opacity: 0 }}
              animate={{
                opacity: shouldShowAmbientVideo && isAmbientVideoReady ? 0 : 1,
              }}
              exit={{ opacity: 0 }}
              transition={HERO_MEDIA_TRANSITION}
            />
          )}

          {videasyBackdropReady ? (
            <motion.div
              className="absolute inset-0 z-0 overflow-hidden pointer-events-none"
              initial={false}
              animate={{ opacity: isAmbientVideoReady ? 1 : 0 }}
              transition={HERO_MEDIA_TRANSITION}
              style={{
                maskImage: HERO_AMBIENT_VIDEO_MASK,
                WebkitMaskImage: HERO_AMBIENT_VIDEO_MASK,
              }}
            >
              <VideasyStreamVideo
                key={`${videasyTrailerUrl ?? ""}|${videasyTrailerHlsUrl ?? ""}`}
                mp4Url={videasyTrailerUrl}
                hlsUrl={videasyTrailerHlsUrl}
                playback="ambient"
                isMuted={isAmbientMuted}
                onAutoplayBlocked={onAmbientAutoplayBlocked}
                onCanPlay={() => setIsAmbientVideoReady(true)}
                onError={onVideasyStreamError}
                className="absolute top-1/2 left-1/2 aspect-video h-[calc(100%+14rem)] min-w-[calc(100%+14rem)] -translate-x-1/2 -translate-y-[calc(50%+25px)] scale-[1.015] object-cover"
              />
            </motion.div>
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
              <div className="md:max-w-7xl lg:max-w-8xl mx-auto h-full">
                {(() => {
                  const videoSrc = getVideoSrc();
                  const iframeKey = `${videoSrc}-${vidnestContentType}-${animePreference}-${selectedServer.id}`;

                  if (!videoSrc) {
                    return (
                      <div className="w-full h-full rounded-lg overflow-hidden shadow-2xl border border-border/20 bg-black/80 flex items-center justify-center">
                        <div className="text-white text-center">
                          <p>Loading video...</p>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <motion.iframe
                      key={iframeKey}
                      src={videoSrc}
                      className="w-full h-full rounded-lg overflow-hidden shadow-2xl border border-border/20"
                      allow="autoplay; encrypted-media; picture-in-picture"
                      allowFullScreen
                    />
                  );
                })()}
              </div>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
