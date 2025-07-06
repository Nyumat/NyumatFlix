"use client";

import { useEpisodeStore } from "@/lib/stores/episode-store";
import { useServerStore } from "@/lib/stores/server-store";
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
  /** Media type from route (tv or movie) */
  mediaType?: "tv" | "movie";
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
  mediaType,
  isPlayingVideo,
  isPlayingTrailer,
  controls,
  onTrailerEnded,
  youtubePlayer,
  setYoutubePlayer,
}: HeroBackgroundProps) {
  // Get episode store state
  const { getEmbedUrl } = useEpisodeStore();
  // Get server store state
  const { selectedServer } = useServerStore();

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

  const trailerKey = currentItemVideos.find(
    (video: { type: string }) => video.type === "Trailer",
  )?.key;

  // Helper function to determine media type when it's not passed
  const getMediaType = (): "movie" | "tv" => {
    // Use passed mediaType first (from route detection)
    if (mediaType) {
      return mediaType;
    }

    // Fall back to media object checking and URL path
    if (media) {
      // Check if it's a TV show using multiple indicators
      const isTvShow =
        media.media_type === "tv" ||
        media.name !== undefined || // TV shows have 'name' instead of 'title'
        media.first_air_date !== undefined || // TV shows have 'first_air_date' instead of 'release_date'
        media.number_of_seasons !== undefined || // TV shows have seasons
        media.number_of_episodes !== undefined; // TV shows have episodes

      if (isTvShow) {
        return "tv";
      }
    }

    // Check URL path as final fallback
    if (typeof window !== "undefined") {
      if (window.location.pathname.includes("/tvshows/")) {
        return "tv";
      } else if (window.location.pathname.includes("/movies/")) {
        return "movie";
      }
    }

    return "movie"; // Final fallback
  };

  // Get the appropriate embed URL
  const getVideoSrc = () => {
    // Detect media type first
    const detectedMediaType = getMediaType();

    console.log("📺 Media type detection:", {
      passedMediaType: mediaType,
      detectedMediaType,
      mediaMediaType: media.media_type,
      hasName: media.name !== undefined,
      hasFirstAirDate: media.first_air_date !== undefined,
      hasSeasons: media.number_of_seasons !== undefined,
      hasEpisodes: media.number_of_episodes !== undefined,
      urlPath: typeof window !== "undefined" ? window.location.pathname : "SSR",
      isTvShow: detectedMediaType === "tv",
    });

    // For TV shows, ONLY allow episode URLs
    if (detectedMediaType === "tv") {
      const episodeEmbedUrl = getEmbedUrl();

      // Log episode store state for debugging
      const { selectedEpisode, tvShowId, seasonNumber } =
        useEpisodeStore.getState();
      console.log("📺 TV Show - Episode Store State:", {
        selectedEpisode: selectedEpisode
          ? {
              id: selectedEpisode.id,
              name: selectedEpisode.name,
              episode_number: selectedEpisode.episode_number,
            }
          : null,
        tvShowId,
        seasonNumber,
        mediaId: media.id,
        hasEpisodeUrl: !!episodeEmbedUrl,
      });

      if (episodeEmbedUrl) {
        console.log("✅ Using TV episode embed URL:", episodeEmbedUrl);
        console.log("🔧 Episode URL breakdown:", {
          server: selectedServer.name,
          tmdbId: tvShowId ? parseInt(tvShowId) : null,
          season: seasonNumber,
          episode: selectedEpisode?.episode_number,
          finalUrl: episodeEmbedUrl,
        });
        return episodeEmbedUrl;
      } else {
        console.log("❌ TV Show: No episode selected - cannot generate URL");
        // Return a placeholder or empty string to prevent generic TV URLs
        return "";
      }
    }

    // For movies, check if there's an episode URL (shouldn't happen, but safety check)
    const episodeEmbedUrl = getEmbedUrl();
    console.log("🎬 Movie - Episode embed URL check:", episodeEmbedUrl);

    if (episodeEmbedUrl) {
      console.log("⚠️ Movie has episode URL (unexpected):", episodeEmbedUrl);
      return episodeEmbedUrl;
    }

    // Generate movie URL
    const finalUrl = selectedServer.getMovieUrl(media.id);
    console.log("🎬 Movie URL generated:", finalUrl);
    console.log("🔧 Selected server:", selectedServer.name);
    console.log("🎯 Final video URL:", finalUrl);

    return finalUrl;
  };

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

  console.log({ selectedServer, media });
  console.log(getVideoSrc());

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
                src={getVideoSrc()}
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
              fetchPriority="high"
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
