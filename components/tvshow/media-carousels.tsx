"use client";

import Image from "next/legacy/image";
import { Star, Tv, User } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Actor, TvShow, Video } from "@/utils/typings";
import { toast } from "sonner";
import { useState } from "react";

type CastCarouselProps = {
  cast: Actor[];
};

export function CastCarousel({ cast }: CastCarouselProps) {
  if (!cast.length) return null;

  return (
    <section>
      <h2 className="text-2xl font-semibold text-white mb-4">Cast</h2>
      <div className="relative">
        <Carousel
          opts={{
            dragFree: true,
            containScroll: "trimSnaps",
          }}
          className="w-full"
        >
          <CarouselContent>
            {cast.slice(0, 25).map((person) => (
              <CarouselItem
                key={person.id}
                className="basis-[140px] md:basis-[140px] lg:basis-[140px]"
              >
                <div className="w-full flex-shrink-0">
                  <div className="rounded-lg overflow-hidden mb-2 aspect-[2/3] bg-gray-800">
                    {person.profile_path ? (
                      <Image
                        src={`https://image.tmdb.org/t/p/w185${person.profile_path}`}
                        alt={person.name}
                        width={185}
                        height={278}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500">
                        <User size={40} />
                      </div>
                    )}
                  </div>
                  <h3 className="text-white font-medium text-sm">
                    {person.name}
                  </h3>
                  <p className="text-gray-400 text-xs">{person.character}</p>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="left-2 bg-black/50 hover:bg-black/70 border-none text-white" />
          <CarouselNext className="right-2 bg-black/50 hover:bg-black/70 border-none text-white" />
        </Carousel>
      </div>
    </section>
  );
}

type VideoCarouselProps = {
  videos: Video[];
};

export function VideoCarousel({ videos }: VideoCarouselProps) {
  const [failedVideos, setFailedVideos] = useState<Set<string>>(new Set());
  if (!videos.length) return null;
  const handleVideoError = (videoId: string, videoName: string) => {
    if (!failedVideos.has(videoId)) {
      setFailedVideos((prev) => {
        const updated = new Set(prev);
        updated.add(videoId);
        return updated;
      });

      toast.error(`Failed to load video: ${videoName}`);
    }
  };

  return (
    <section>
      <h2 className="text-2xl font-semibold text-white mb-4">Videos</h2>
      <div className="relative">
        <Carousel
          opts={{
            dragFree: true,
            containScroll: "trimSnaps",
          }}
          className="w-full"
        >
          <CarouselContent>
            {videos.slice(0, 10).map((video) => (
              <CarouselItem
                key={video.id}
                className="basis-[280px] md:basis-[280px] lg:basis-[280px]"
              >
                <div className="w-full flex-shrink-0">
                  <div className="rounded-lg overflow-hidden mb-2 aspect-video bg-gray-800">
                    <iframe
                      src={`https://www.youtube.com/embed/${video.key}`}
                      title={video.name}
                      className="w-full h-full"
                      allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      onError={() => handleVideoError(video.id, video.name)}
                    ></iframe>
                  </div>
                  <h3 className="text-white font-medium text-sm truncate">
                    {video.name}
                  </h3>
                  <p className="text-gray-400 text-xs">{video.type}</p>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="left-2 bg-black/50 hover:bg-black/70 border-none text-white" />
          <CarouselNext className="right-2 bg-black/50 hover:bg-black/70 border-none text-white" />
        </Carousel>
      </div>
    </section>
  );
}

type RecommendedCarouselProps = {
  shows: TvShow[];
};

export function RecommendedCarousel({ shows }: RecommendedCarouselProps) {
  if (!shows.length) return null;

  return (
    <section>
      <h2 className="text-2xl font-semibold text-white mb-4">Recommended</h2>
      <div className="relative">
        <Carousel
          opts={{
            dragFree: true,
            containScroll: "trimSnaps",
          }}
          className="w-full"
        >
          <CarouselContent>
            {shows.slice(0, 15).map((show) => (
              <CarouselItem
                key={show.id}
                className="basis-[160px] md:basis-[160px] lg:basis-[160px]"
              >
                <a
                  href={`/tvshows/${show.id}`}
                  className="w-full flex-shrink-0 hover:opacity-80 transition"
                >
                  <div className="rounded-lg overflow-hidden mb-2 aspect-[2/3] bg-gray-800">
                    {show.poster_path ? (
                      <Image
                        src={`https://image.tmdb.org/t/p/w185${show.poster_path}`}
                        alt={show.name}
                        width={185}
                        height={278}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500">
                        <Tv size={30} />
                      </div>
                    )}
                  </div>
                  <h3 className="text-white font-medium text-sm truncate">
                    {show.name}
                  </h3>
                  <div className="flex items-center mt-1">
                    <Star size={12} className="text-yellow-500 mr-1" />
                    <span className="text-gray-400 text-xs">
                      {show.vote_average?.toFixed(1)}
                    </span>
                  </div>
                </a>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="left-2 bg-black/50 hover:bg-black/70 border-none text-white" />
          <CarouselNext className="right-2 bg-black/50 hover:bg-black/70 border-none text-white" />
        </Carousel>
      </div>
    </section>
  );
}
