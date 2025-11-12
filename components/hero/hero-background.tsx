"use client";

import { useEpisodeStore } from "@/lib/stores/episode-store";
import { useServerStore } from "@/lib/stores/server-store";
import { logger } from "@/lib/utils";
import { MediaItem } from "@/utils/typings";
import {
  AnimatePresence,
  LegacyAnimationControls,
  motion,
} from "framer-motion";
import { useEffect, useRef } from "react";
import { YouTubePlayer } from "./youtube-types";

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
}: HeroBackgroundProps) {
  const { getEmbedUrl } = useEpisodeStore();
  const { selectedServer, vidnestContentType, animePreference } =
    useServerStore();
  let currentItemVideos: { type: string; key: string }[] = [];

  if (media.videos) {
    if (Array.isArray(media.videos)) {
      currentItemVideos = media.videos as { type: string; key: string }[];
    } else if (typeof media.videos === "object" && media.videos !== null) {
      const videosObj = media.videos as { results?: unknown };
      if (videosObj.results && Array.isArray(videosObj.results)) {
        currentItemVideos = videosObj.results as {
          type: string;
          key: string;
        }[];
      }
    }
  }

  const acceptableVideoTypes = ["Trailer", "Teaser", "Clip", "Featurette"];
  const trailerVideo = currentItemVideos.find((video: { type: string }) =>
    acceptableVideoTypes.includes(video.type),
  );
  const trailerKey = trailerVideo?.key;

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

  // I'm using a timeout to detect long pauses (>1s).
  const pauseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (isPlayingTrailer && (e.key === "x" || e.key === "X")) {
        if (youtubePlayer) {
          youtubePlayer.destroy();
          setYoutubePlayer(null);
        }
        onTrailerEnded();
      }
    };

    if (isPlayingTrailer) {
      window.addEventListener("keydown", handleKeyPress);
    }

    return () => {
      window.removeEventListener("keydown", handleKeyPress);
    };
  }, [isPlayingTrailer, youtubePlayer, onTrailerEnded, setYoutubePlayer]);

  useEffect(() => {
    if (
      isPlayingTrailer &&
      trailerKey &&
      typeof window !== "undefined" &&
      window.YT
    ) {
      if (!youtubePlayer) {
        try {
          const player = new window.YT.Player("trailer-player", {
            videoId: trailerKey,
            playerVars: {
              autoplay: 1,
              controls: 1,
              rel: 0,
            },
            events: {
              onStateChange: (event: { data: number }) => {
                if (event.data === 0) {
                  onTrailerEnded();
                  return;
                }

                // I'm only treating a pause as the end of the trailer if it's paused for more than a second.
                if (event.data === 2) {
                  if (pauseTimeoutRef.current) {
                    clearTimeout(pauseTimeoutRef.current);
                  }

                  pauseTimeoutRef.current = setTimeout(() => {
                    try {
                      const playerState = (
                        player as YouTubePlayer
                      )?.getPlayerState?.();
                      if (playerState === 2) {
                        onTrailerEnded();
                      }
                    } catch {
                      // I'm silently handling player state errors here.
                    }
                  }, 1000);
                  return;
                }

                if (pauseTimeoutRef.current) {
                  clearTimeout(pauseTimeoutRef.current);
                  pauseTimeoutRef.current = null;
                }
              },
            },
          });
          setYoutubePlayer(player);
        } catch (error) {
          logger.error("Error initializing YouTube player", error);
        }
      }
    }

    return () => {
      if (pauseTimeoutRef.current) {
        clearTimeout(pauseTimeoutRef.current);
        pauseTimeoutRef.current = null;
      }

      if (youtubePlayer && youtubePlayer.destroy) {
        youtubePlayer.destroy();
        setYoutubePlayer(null);
      }
    };
  }, [
    isPlayingTrailer,
    trailerKey,
    onTrailerEnded,
    youtubePlayer,
    setYoutubePlayer,
  ]);

  return (
    <div className="absolute inset-0 z-0">
      <AnimatePresence mode="popLayout">
        <motion.div
          key={media.backdrop_path}
          className="relative h-full w-full"
          animate={controls}
        >
          <motion.img
            src={`https://image.tmdb.org/t/p/original${
              media.backdrop_path ?? media.poster_path
            }`}
            fetchPriority="high"
            alt={(media.title || media.name) as string}
            className="w-full h-full object-cover absolute inset-0 z-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0.5 }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
          />
          <div className="absolute inset-0 z-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent"></div>

          {isPlayingTrailer && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="w-full absolute z-30 px-4 sm:px-6 lg:px-8"
              style={{ top: "5rem", height: "calc(100% - 11rem)" }}
            >
              <div className="md:max-w-7xl lg:max-w-8xl mx-auto h-full">
                <div
                  id="trailer-player"
                  className="w-full h-full rounded-lg overflow-hidden shadow-2xl border border-border/20"
                ></div>
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

                  console.log("[HeroBackground] Video iframe:", {
                    videoSrc,
                    vidnestContentType,
                    animePreference,
                    selectedServerId: selectedServer.id,
                    iframeKey,
                  });

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
