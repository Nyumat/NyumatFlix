"use client";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CreditsReponse, MediaItem } from "@/utils/typings";
import { format } from "date-fns";
import {
  AnimatePresence,
  AnimationControls,
  motion,
  useAnimation,
} from "framer-motion";
import { Calendar, Clock, DollarSign, Play, Plus, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface HeroSectionProps {
  media: MediaItem[];
  noSlide?: boolean;
  isWatch?: boolean;
}

export function HeroSection({
  media,
  noSlide,
  isWatch = false,
}: HeroSectionProps) {
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  const [isPlayingTrailer, setIsPlayingTrailer] = useState(false);
  const [showCast, setShowCast] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controls = useAnimation();

  const handleNext = useCallback(() => {
    setCurrentItemIndex((prevIndex) =>
      prevIndex === media.length - 1 ? 0 : prevIndex + 1,
    );
    setIsPlayingVideo(false);
    setIsPlayingTrailer(false);
    setShowCast(false);
  }, [media.length]);

  useEffect(() => {
    const ref = timeoutRef.current;
    if (ref) {
      clearTimeout(ref);
    }

    return () => {
      if (ref) {
        clearTimeout(ref);
      }
    };
  }, [timeoutRef]);

  useEffect(() => {
    if (!isPlayingVideo && !noSlide && !isWatch && !isPlayingTrailer) {
      const interval = setInterval(() => {
        handleNext();
      }, 7000);

      return () => {
        clearInterval(interval);
      };
    }
  }, [currentItemIndex, isPlayingVideo, noSlide, isWatch, isPlayingTrailer]);

  const currentItem = media[currentItemIndex];
  const formattedDate = useMemo(() => {
    if (!currentItem?.release_date) return "";
    return format(new Date(currentItem.release_date), "MMMM dd, yyyy");
  }, [currentItem?.release_date]);

  const handleWatch = () => {
    setIsPlayingTrailer(false);
    setIsPlayingVideo(true);
  };

  const handlePlayTrailer = () => {
    setIsPlayingVideo(false);
    setIsPlayingTrailer(true);
  };

  const toggleCast = () => {
    setShowCast(!showCast);
  };

  return (
    <div className={`relative ${isWatch ? "h-[100vh]" : "h-[82vh]"}`}>
      <HeroBackground
        media={currentItem}
        isPlayingVideo={isPlayingVideo}
        isPlayingTrailer={isPlayingTrailer}
        controls={controls}
      />
      <HeroContent
        media={currentItem}
        isWatch={isWatch}
        formattedDate={formattedDate}
        isPlayingVideo={isPlayingVideo}
        isPlayingTrailer={isPlayingTrailer}
        handleWatch={handleWatch}
        handlePlayTrailer={handlePlayTrailer}
        toggleCast={toggleCast}
        showCast={showCast}
      />
      {!noSlide && !isPlayingVideo && !isWatch && media.length > 1 && (
        <HeroPagination media={media} currentItemIndex={currentItemIndex} />
      )}
    </div>
  );
}

function HeroBackground({
  media,
  isPlayingVideo,
  isPlayingTrailer,
  controls,
}: {
  media: MediaItem;
  isPlayingVideo: boolean;
  isPlayingTrailer: boolean;
  controls: AnimationControls;
}) {
  const currentItemVideos = media.videos ?? media.videos?.results;

  return (
    <div className="absolute inset-0 z-0">
      <AnimatePresence mode="popLayout">
        <motion.div
          key={media.backdrop_path}
          className="relative h-full w-full"
          animate={controls}
        >
          {isPlayingTrailer && (
            <motion.iframe
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              src={`https://www.youtube.com/embed/${
                currentItemVideos?.find(
                  (video: { type: string }) => video.type === "Trailer",
                )?.key
              }`}
              className="w-full h-full absolute inset-0"
              allow="autoplay; encrypted-media"
              allowFullScreen
            />
          )}
          {isPlayingVideo && (
            <motion.iframe
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              src={`https://vidsrc.xyz/embed/movie/${media.id}`}
              className="w-full h-full absolute inset-0"
              allow="autoplay; encrypted-media"
              allowFullScreen
            />
          )}
          {!isPlayingVideo && !isPlayingTrailer && (
            <motion.img
              src={`https://image.tmdb.org/t/p/original${
                media.backdrop_path ?? media.poster_path
              }`}
              alt={media.title}
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

function HeroContent({
  media,
  isWatch,
  formattedDate,
  isPlayingVideo,
  isPlayingTrailer,
  handleWatch,
  handlePlayTrailer,
  toggleCast,
  showCast,
}: {
  media: MediaItem;
  isWatch: boolean;
  formattedDate: string;
  isPlayingVideo: boolean;
  isPlayingTrailer: boolean;
  handleWatch: () => void;
  handlePlayTrailer: () => void;
  toggleCast: () => void;
  showCast: boolean;
}) {
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
              <h1 className="text-4xl font-bold text-white mb-4">
                {media.title}
              </h1>
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
              />
              <p className="text-gray-200 mb-6">{media.overview}</p>
              <HeroButtons
                isWatch={isWatch}
                handleWatch={handleWatch}
                handlePlayTrailer={handlePlayTrailer}
                toggleCast={toggleCast}
                showCast={showCast}
                mediaId={media.id}
              />
              {isWatch && showCast && <HeroCast credits={media.credits} />}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function HeroGradients() {
  return (
    <>
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-black via-black/20 to-transparent z-10"
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
      />
      <motion.div
        className="absolute inset-0 bg-gradient-to-l from-black via-black/20 to-transparent z-10"
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
      />
      <motion.div
        className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent z-10"
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
      />
    </>
  );
}

function HeroGenres({ genres }: { genres?: { id: number; name: string }[] }) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {genres?.map((genre) => (
        <Badge key={genre.id} variant="secondary">
          {genre.name}
        </Badge>
      ))}
    </div>
  );
}

function HeroDetails({
  formattedDate,
  runtime,
  budget,
  voteAverage,
  isWatch,
}: {
  formattedDate: string;
  runtime?: number;
  budget?: number;
  voteAverage?: number;
  isWatch: boolean;
}) {
  return (
    <div className="flex items-center space-x-6 mb-4 text-gray-300">
      <div className="flex items-center">
        <Calendar className="mr-2" size={16} />
        <span suppressHydrationWarning>{formattedDate}</span>
      </div>
      {isWatch && (
        <>
          <div className="flex items-center">
            <Clock className="mr-2" size={16} />
            <span>{runtime} min</span>
          </div>
          <div className="flex items-center">
            <DollarSign className="mr-2" size={16} />
            <span>${budget?.toLocaleString()}</span>
          </div>
        </>
      )}
      <div className="flex items-center">
        <Star className="mr-2" size={16} />
        <span>{voteAverage?.toFixed(1)}</span>
      </div>
    </div>
  );
}

function HeroButtons({
  isWatch,
  handleWatch,
  handlePlayTrailer,
  toggleCast,
  showCast,
  mediaId,
}: {
  isWatch: boolean;
  handleWatch: () => void;
  handlePlayTrailer: () => void;
  toggleCast: () => void;
  showCast: boolean;
  mediaId: number;
}) {
  return (
    <div className="flex items-center space-x-4 mb-6">
      {isWatch ? (
        <button
          className="bg-secondary text-white py-3 px-6 rounded-full font-bold hover:bg-secondary/80 transition flex items-center"
          onClick={handleWatch}
        >
          <Play className="mr-2" size={20} />
          Watch Now
        </button>
      ) : (
        <Link href={`/watch/${mediaId}`}>
          <div className="bg-secondary text-white py-3 px-6 rounded-full font-bold hover:bg-secondary/80 transition flex items-center">
            <Play className="mr-2" size={20} />
            Watch Now
          </div>
        </Link>
      )}

      <button
        className="border border-white text-white py-3 px-6 rounded-full font-bold hover:bg-white hover:text-black transition flex items-center"
        onClick={handlePlayTrailer}
      >
        <Plus className="mr-2" size={20} />
        Watch Trailer
      </button>

      {isWatch && (
        <button
          className="text-white py-3 px-6 rounded-full font-bold hover:bg-white/20 transition"
          onClick={toggleCast}
        >
          {showCast ? "Hide Cast" : "Show Cast"}
        </button>
      )}
    </div>
  );
}

function HeroCast({ credits }: { credits: CreditsReponse }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.3 }}
      >
        <ScrollArea className="h-32 w-1/3">
          <div className="flex space-x-4 overflow-x-auto">
            {credits?.cast
              ?.filter((c: { profile_path: string }) => c.profile_path !== null)
              .map(
                (actor: {
                  id: number;
                  name: string;
                  profile_path: string;
                  character: string;
                }) => (
                  <div key={actor.id} className="flex-shrink-0 text-center">
                    <Image
                      src={`https://image.tmdb.org/t/p/w200${actor.profile_path}`}
                      alt={actor.name}
                      className="w-16 h-16 rounded-full mb-2 mx-auto object-cover"
                      width={64}
                      height={64}
                    />
                    <p className="text-white text-sm">{actor.name}</p>
                    <p className="text-gray-400 text-xs">{actor.character}</p>
                  </div>
                ),
              )}
          </div>
        </ScrollArea>
      </motion.div>
    </AnimatePresence>
  );
}

function HeroPagination({
  media,
  currentItemIndex,
}: {
  media: MediaItem[];
  currentItemIndex: number;
}) {
  return (
    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex justify-center space-x-2 z-30">
      {media.map((_, index) => (
        <div
          key={index}
          className={`w-2 h-2 rounded-full ${
            index === currentItemIndex ? "bg-white" : "bg-white/50"
          }`}
        />
      ))}
    </div>
  );
}
