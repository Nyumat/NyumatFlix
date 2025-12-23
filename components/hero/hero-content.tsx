"use client";

import { useEpisodeStore } from "@/lib/stores/episode-store";
import { MediaItem, Movie, TvShow } from "@/utils/typings";
import { format } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import Image from "next/legacy/image";
import { useEffect, useMemo } from "react";
import { HeroButtons } from "./hero-buttons";
import { HeroDetails } from "./hero-details";
import { HeroGenres } from "./hero-genres";
import { HeroGradients } from "./hero-gradients";
import type { YouTubePlayer } from "./youtube-types";
import { ServerSelector } from "../ui/server-selector";

interface HeroContentProps {
  media: MediaItem;
  mediaType?: "tv" | "movie";
  isWatch: boolean;
  isPlayingVideo: boolean;
  isPlayingTrailer: boolean;
  handleWatch(): void;
  handlePlayTrailer(): void;
  handleTrailerEnded(): void;
  youtubePlayer: YouTubePlayer;
  setYoutubePlayer(player: YouTubePlayer): void;
  isUpcoming?: boolean;
}

export function HeroContent({
  media,
  mediaType,
  isWatch,
  isPlayingVideo,
  isPlayingTrailer,
  handleWatch,
  handlePlayTrailer,
  handleTrailerEnded,
  youtubePlayer,
  setYoutubePlayer,
  isUpcoming = false,
}: HeroContentProps) {
  const {
    selectedEpisode,
    seasonNumber,
    tvShowId,
    clearSelectedEpisode,
    setWatchCallback,
  } = useEpisodeStore();
  const title = media.title || media.name;

  // Set the watch callback in the episode store
  useEffect(() => {
    if (mediaType === "tv") {
      setWatchCallback(() => {
        handleWatch();
        // Scroll to top to show the video
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }
  }, [handleWatch, mediaType, setWatchCallback]);

  // Clear selected episode when switching to a different TV show or to a movie
  useEffect(() => {
    if (mediaType !== "tv" || (tvShowId && tvShowId !== media.id.toString())) {
      clearSelectedEpisode();
    }
  }, [media.id, mediaType, tvShowId, clearSelectedEpisode]);

  const formattedDate = useMemo(() => {
    if (media?.release_date) {
      return format(new Date(media.release_date), "MMMM dd, yyyy");
    }
    if (media?.first_air_date) {
      return format(new Date(media.first_air_date), "MMMM dd, yyyy");
    }
    return "";
  }, [media?.release_date, media?.first_air_date]);

  return (
    <div>
      {(isPlayingVideo || isPlayingTrailer) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="absolute z-50 px-4 sm:px-6 lg:px-8 pt-4"
          style={{ top: "calc(100% - 6rem)", left: 0, right: 0 }}
        >
          <div className="md:max-w-7xl lg:max-w-8xl mx-auto flex items-center justify-end gap-3 sm:gap-4">
            <ServerSelector media={media} mediaType={mediaType} />
            <button
              onClick={() => {
                if (isPlayingTrailer && youtubePlayer) {
                  youtubePlayer.destroy();
                  setYoutubePlayer(null);
                }
                handleTrailerEnded();
              }}
              className="group relative bg-background/90 hover:bg-background backdrop-blur-md transition-all duration-200 rounded-full p-2.5 sm:p-3 text-foreground border border-border/50 hover:border-border shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
              aria-label={isPlayingTrailer ? "Stop trailer" : "Close video"}
            >
              <X
                size={20}
                className="sm:w-6 sm:h-6 transition-transform duration-200 group-hover:rotate-90"
                strokeWidth={2.5}
              />
            </button>
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {!isPlayingVideo && !isPlayingTrailer && (
          <div>
            <HeroGradients />

            <motion.div
              className="absolute inset-0 flex items-center z-20 px-4 sm:px-6 lg:px-8"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="md:max-w-7xl lg:max-w-8xl mx-auto w-full">
                <div
                  className={`${isWatch ? "max-w-3xl" : "max-w-2xl translate-y-36"} py-16`}
                >
                  {media.logo ? (
                    <div className="mb-4 max-w-[200px] md:max-w-[300px] w-auto">
                      <Image
                        src={`https://image.tmdb.org/t/p/w342${media.logo.file_path}`}
                        alt={(title as string) || "Logo"}
                        width={media.logo.width || 200}
                        height={media.logo.height || 100}
                        layout="responsive"
                        objectFit="contain"
                      />
                    </div>
                  ) : (
                    <h1 className="text-4xl font-bold text-foreground mb-4">
                      {title as string}
                    </h1>
                  )}

                  {/* Episode Selection Display */}
                  {selectedEpisode && seasonNumber && mediaType === "tv" && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mb-4 p-3 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-between"
                    >
                      <div>
                        <p className="text-primary font-medium">
                          Selected: Season {seasonNumber}, Episode{" "}
                          {selectedEpisode.episode_number}
                        </p>
                        <p className="text-primary/80 text-sm">
                          {selectedEpisode.name}
                        </p>
                      </div>
                      <button
                        onClick={clearSelectedEpisode}
                        className="ml-4 p-1 hover:bg-primary/20 rounded-full transition-colors"
                        aria-label="Clear episode selection"
                      >
                        <X size={16} className="text-primary" />
                      </button>
                    </motion.div>
                  )}

                  {isWatch && (
                    <>
                      {media.tagline && (
                        <p className="text-xl text-muted-foreground mb-4">
                          {(media as Movie).tagline}
                        </p>
                      )}
                      {!isUpcoming && (
                        <HeroGenres
                          genres={(media as Movie).genres}
                          mediaType={mediaType}
                        />
                      )}
                    </>
                  )}
                  <HeroDetails
                    formattedDate={formattedDate}
                    runtime={(media as Movie).runtime}
                    budget={(media as Movie).budget}
                    voteAverage={media.vote_average}
                    isWatch={isWatch}
                    seasons={(media as TvShow).number_of_seasons}
                    episodes={(media as TvShow).number_of_episodes}
                    isUpcoming={isUpcoming}
                  />
                  {media.overview && !isWatch && (
                    <p className="text-foreground/80 mb-6">{media.overview}</p>
                  )}
                  <div className="flex items-center flex-wrap gap-4 mb-6">
                    <HeroButtons
                      handleWatch={handleWatch}
                      handlePlayTrailer={handlePlayTrailer}
                      mediaType={mediaType}
                      isUpcoming={isUpcoming}
                      contentId={media.id}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
