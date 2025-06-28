"use client";

import { useMemo } from "react";
import { MediaItem } from "@/utils/typings";
import { AnimatePresence, motion } from "framer-motion";
import { format } from "date-fns";
import Image from "next/legacy/image";

import { HeroGradients } from "./hero-gradients";
import { HeroGenres } from "./hero-genres";
import { HeroDetails } from "./hero-details";
import { HeroButtons } from "./hero-buttons";

interface HeroContentProps {
  media: MediaItem;
  isWatch: boolean;
  isPlayingVideo: boolean;
  isPlayingTrailer: boolean;
  handleWatch: () => void;
  handlePlayTrailer: () => void;
}

export function HeroContent({
  media,
  isWatch,
  isPlayingVideo,
  isPlayingTrailer,
  handleWatch,
  handlePlayTrailer,
}: HeroContentProps) {
  const title = media.title || media.name;

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
                <h1 className="text-4xl font-bold text-white mb-4">{title}</h1>
              )}
              {isWatch && (
                <>
                  <p className="text-xl text-gray-300 mb-4">{media.tagline}</p>
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
              <p className="text-gray-200 mb-6">{media.overview}</p>
              <HeroButtons
                isWatch={isWatch}
                handleWatch={handleWatch}
                handlePlayTrailer={handlePlayTrailer}
                mediaId={media.id}
              />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
