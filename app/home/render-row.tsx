"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import HackerButton from "@/components/animated/sribble";
import { ChevronLeft, ChevronRight, Clock, Plus } from "lucide-react";
import { Movie } from "./page";
import { format } from "date-fns";
import { Rating } from "@/components/ui/rating";

interface HeroSectionProps {
  movies: Movie[];
}

export function HeroSection({ movies }: HeroSectionProps) {
  const [currentMovieIndex, setCurrentMovieIndex] = useState(0);
  const [triggerScramble, setTriggerScramble] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controls = useAnimation();

  const handleNext = () => {
    setCurrentMovieIndex((prevIndex) =>
      prevIndex === movies.length - 1 ? 0 : prevIndex + 1,
    );
    setTriggerScramble(true);
  };

  const handlePrev = () => {
    setCurrentMovieIndex((prevIndex) =>
      prevIndex === 0 ? movies.length - 1 : prevIndex - 1,
    );
    setTriggerScramble(true);
  };

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setTriggerScramble(false);
    }, 1000);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [currentMovieIndex]);

  const handleDragEnd = (event: any, info: any) => {
    const threshold = 50; // minimum distance to trigger slide change
    if (info.offset.x > threshold) {
      handlePrev();
    } else if (info.offset.x < -threshold) {
      handleNext();
    } else {
      controls.start({ x: 0 });
    }
  };

  const currentMovie = movies[currentMovieIndex];
  const formattedDate = useMemo(() => {
    return format(new Date(currentMovie.release_date), "MMMM dd, yyyy");
  }, [currentMovie.release_date]);

  return (
    <div className="h-[80vh] overflow-hidden bg-black">
      <AnimatePresence mode="sync">
        <motion.div
          key={currentMovie.backdrop_path}
          className="w-full h-full absolute inset-0"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={handleDragEnd}
          animate={controls}
        >
          <motion.img
            src={`https://image.tmdb.org/t/p/original${currentMovie.backdrop_path}`}
            alt={currentMovie.title}
            className="w-full h-full object-cover absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0.5 }}
            transition={{ duration: 1, ease: "easeInOut" }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/50 to-transparent" />
          <motion.div
            className="absolute inset-0 flex items-center p-16"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          >
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-secondary mb-2">Movie</p>
              <h1 className="text-4xl font-bold text-white mb-4">
                {currentMovie.title}
              </h1>
              <div className="text-sm text-gray-300 mb-4">
                {formattedDate} <br/>
                 {currentMovie?.categories?.join("  \u00B7  ")}
              <Rating rating={currentMovie.vote_average} maxRating={10} size="small" className="mt-1" />
              </div>
              <p className="text-gray-200 mb-6 hidden md:block">
                {currentMovie.overview}
              </p>
              <div className="flex items-center space-x-4">
                <button className="bg-secondary text-white py-3 px-6 rounded-full font-bold hover:bg-secondary/80 transition flex items-center">
                  <Clock className="mr-2" size={20} />
                  Watch Trailer
                </button>
                <button className="border border-white text-white py-3 px-6 rounded-full font-bold hover:bg-white hover:text-black transition flex items-center">
                  <Plus className="mr-2" size={20} />
                  Add Watchlist
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
      <button
        onClick={handlePrev}
        className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black/50 text-white p-2 rounded-full"
      >
        <ChevronLeft size={24} />
      </button>
      <button
        onClick={handleNext}
        className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black/50 text-white p-2 rounded-full"
      >
        <ChevronRight size={24} />
      </button>
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
        {movies.map((_, index) => (
          <div
            key={index}
            className={`w-2 h-2 rounded-full ${
              index === currentMovieIndex ? "bg-white" : "bg-white/50"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
