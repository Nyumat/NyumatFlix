"use client";

import { logger } from "@/lib/utils";
import { MediaItem } from "@/utils/typings";
import { AnimatePresence, AnimationControls, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { YouTubePlayer } from "./youtube-types";

/**
 * Props for the HeroBackground component
 */
interface HeroBackgroundProps {
  /** Media item to display in the background */
  media: MediaItem;
  /** Whether a video is currently playing */
  isPlayingVideo: boolean;
  /** Whether a trailer is currently playing */
  isPlayingTrailer: boolean;
  /** Animation controls for the background */
  controls: AnimationControls;
  /** Callback function when trailer ends */
  onTrailerEnded: () => void;
  /** YouTube player instance */
  youtubePlayer: YouTubePlayer;
  /** Setter for YouTube player instance */
  setYoutubePlayer: React.Dispatch<React.SetStateAction<YouTubePlayer>>;
}

/**
 * HeroBackground component manages the background display for hero sections
 * Handles background images, video playback, and YouTube trailer integration
 * @param props - The component props
 * @returns A dynamic background component with video and image support
 */
export function HeroBackground({
  media,
  isPlayingVideo,
  isPlayingTrailer,
  controls,
  onTrailerEnded,
  youtubePlayer,
  setYoutubePlayer,
}: HeroBackgroundProps) {
  // Extract videos from media object
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

  const mediaType = media.media_type;
  const trailerKey = currentItemVideos.find(
    (video: { type: string }) => video.type === "Trailer",
  )?.key;

  // Timeout ref to detect long pauses (>1s)
  const pauseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Add keyboard event listener for stopping trailer with X key
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

  // Setup YouTube player when trailer is played
  useEffect(() => {
    if (
      isPlayingTrailer &&
      trailerKey &&
      typeof window !== "undefined" &&
      window.YT
    ) {
      // If YouTube API is loaded and player does not exist
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
                // 0 = ended
                if (event.data === 0) {
                  onTrailerEnded();
                  return;
                }

                // 2 = paused. Only treat as end if paused > 1s.
                if (event.data === 2) {
                  if (pauseTimeoutRef.current) {
                    clearTimeout(pauseTimeoutRef.current);
                  }

                  pauseTimeoutRef.current = setTimeout(() => {
                    try {
                      // If the player is still paused after 1 second, end the trailer
                      const playerState = (
                        player as YouTubePlayer
                      )?.getPlayerState?.();
                      if (playerState === 2) {
                        onTrailerEnded();
                      }
                    } catch {
                      // Silently handle player state errors
                    }
                  }, 1000);
                  return;
                }

                // Any other state (playing, buffering, etc.) => clear pending timeout
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

    // Cleanup
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
          {isPlayingTrailer && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="w-full h-full absolute inset-0 z-30"
            >
              <button
                onClick={() => {
                  if (youtubePlayer) {
                    youtubePlayer.destroy();
                    setYoutubePlayer(null);
                  }
                  onTrailerEnded();
                }}
                className="absolute top-6 left-6 z-50 bg-background/80 hover:bg-background/90 backdrop-blur-sm transition-colors rounded-full p-2 text-foreground border border-border"
                aria-label="Stop trailer"
              >
                <X size={24} />
              </button>
              {/* Use a div for YouTube API to attach to */}
              <div id="trailer-player" className="w-full h-full"></div>
            </motion.div>
          )}
          {isPlayingVideo && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="w-full h-full absolute inset-0 z-30"
            >
              <button
                onClick={() => onTrailerEnded()}
                className="absolute top-6 left-6 z-50 bg-background/80 hover:bg-background/90 backdrop-blur-sm transition-colors rounded-full p-2 text-foreground border border-border"
                aria-label="Close video"
              >
                <X size={24} />
              </button>
              <motion.iframe
                src={`https://vidsrc.xyz/embed/${mediaType}/${media.id}`}
                className="w-full h-full"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            </motion.div>
          )}
          {!isPlayingVideo && !isPlayingTrailer && (
            <motion.img
              src={`https://image.tmdb.org/t/p/original${
                media.backdrop_path ?? media.poster_path
              }`}
              alt={media.title || media.name}
              className="w-full h-full object-cover absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0.5 }}
              transition={{ duration: 1.5, ease: "easeInOut" }}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
