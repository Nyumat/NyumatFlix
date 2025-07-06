"use client";

import { MediaItem } from "@/utils/typings";
import { format } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import Image from "next/legacy/image";
import { useEffect, useMemo } from "react";

import { useEpisodeStore } from "@/lib/stores/episode-store";
import { ServerSelector } from "../ui/server-selector";
import { HeroButtons } from "./hero-buttons";
import { HeroDetails } from "./hero-details";
import { HeroGenres } from "./hero-genres";
import { HeroGradients } from "./hero-gradients";

interface HeroContentProps {
  media: MediaItem;
  mediaType?: "tv" | "movie";
  isWatch: boolean;
  isPlayingVideo: boolean;
  isPlayingTrailer: boolean;
  handleWatch: () => void;
  handlePlayTrailer: () => void;
}

export function HeroContent({
  media,
  mediaType,
  isWatch,
  isPlayingVideo,
  isPlayingTrailer,
  handleWatch,
  handlePlayTrailer,
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
      {/* Server Selector when video/trailer is playing - top right */}
      {(isPlayingVideo || isPlayingTrailer) && (
        <div className="absolute top-6 right-6 z-50">
          <ServerSelector media={media} mediaType={mediaType} />
        </div>
      )}

      <AnimatePresence>
        {!isPlayingVideo && !isPlayingTrailer && (
          <div>
            <HeroGradients />

            <motion.div
              className="absolute inset-0 flex items-center p-16 z-20"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div
                className={`${isWatch ? "max-w-3xl" : "max-w-2xl translate-y-36"}`}
              >
                {media.logo ? (
                  <div className="mb-4 max-w-[200px] md:max-w-[300px] w-auto">
                    <Image
                      src={`https://image.tmdb.org/t/p/w342${media.logo.file_path}`}
                      alt={title}
                      width={media.logo.width || 200}
                      height={media.logo.height || 100}
                      layout="responsive"
                      objectFit="contain"
                    />
                  </div>
                ) : (
                  <h1 className="text-4xl font-bold text-foreground mb-4">
                    {title}
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
                        {media.tagline}
                      </p>
                    )}
                    <HeroGenres genres={media.genres} />
                  </>
                )}
                <HeroDetails
                  formattedDate={formattedDate}
                  runtime={media.runtime}
                  budget={media.budget}
                  voteAverage={media.vote_average}
                  isWatch={isWatch}
                  seasons={media.number_of_seasons}
                  episodes={media.number_of_episodes}
                />
                {media.overview && !isWatch && (
                  <p className="text-foreground/80 mb-6">{media.overview}</p>
                )}

                {/* Buttons and Server Selector together */}
                <div className="flex items-center flex-wrap gap-4 mb-6">
                  <HeroButtons
                    handleWatch={handleWatch}
                    handlePlayTrailer={handlePlayTrailer}
                    mediaType={mediaType}
                  />
                  <ServerSelector
                    media={media}
                    mediaType={mediaType}
                    className="flex-shrink-0"
                  />
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
