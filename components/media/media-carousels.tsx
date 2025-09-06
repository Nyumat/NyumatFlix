"use client";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Actor, Movie, TvShow, Video } from "@/utils/typings";
import { Star, Tv, User } from "lucide-react";
import Image from "next/legacy/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

type MediaCarouselsProps = {
  cast?: Actor[];
  videos?: Video[];
  recommendations?: (Movie | TvShow)[];
  mediaType: "movie" | "tv";
};

export function MediaCarousels({
  cast = [],
  videos = [],
  recommendations = [],
  mediaType,
}: MediaCarouselsProps) {
  return (
    <div className="space-y-8">
      {cast.length > 0 && <CastCarousel cast={cast} />}
      {videos.length > 0 && <VideoCarousel videos={videos} />}
      {recommendations.length > 0 && (
        <RecommendationsCarousel
          recommendations={recommendations}
          mediaType={mediaType}
        />
      )}
    </div>
  );
}

type CastCarouselProps = {
  cast: Actor[];
};

export function CastCarousel({ cast }: CastCarouselProps) {
  const router = useRouter();
  if (!cast.length) return null;

  return (
    <section>
      <h2 className="text-2xl font-semibold text-foreground mb-4">Cast</h2>
      <div className="relative">
        <Carousel
          opts={{
            dragFree: true,
            containScroll: "trimSnaps",
          }}
          className="w-full"
        >
          <CarouselContent>
            {cast.slice(0, 20).map((person: Actor) => (
              <CarouselItem
                key={person.id}
                className="basis-1/3 sm:basis-1/4 md:basis-1/5 lg:basis-1/6 xl:basis-1/8"
              >
                <div
                  className="w-full flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => router.push(`/person/${person.id}`)}
                >
                  <div className="rounded-lg overflow-hidden mb-3 aspect-[2/3] bg-muted">
                    {person.profile_path ? (
                      <Image
                        src={`https://image.tmdb.org/t/p/w185${person.profile_path}`}
                        alt={person.name}
                        width={185}
                        height={278}
                        layout="responsive"
                        objectFit="cover"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <User size={48} />
                      </div>
                    )}
                  </div>
                  <div className="text-center">
                    <h3 className="text-foreground font-medium text-sm mb-1 line-clamp-2">
                      {person.name}
                    </h3>
                    <p className="text-muted-foreground text-xs line-clamp-2">
                      {person.character}
                    </p>
                  </div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="left-2 bg-background/80 hover:bg-background/90 border border-border text-foreground backdrop-blur-sm" />
          <CarouselNext className="right-2 bg-background/80 hover:bg-background/90 border border-border text-foreground backdrop-blur-sm" />
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

  const youtubeVideos = videos.filter((video) => video.site === "YouTube");

  return (
    <section>
      <h2 className="text-2xl font-semibold text-foreground mb-4">Videos</h2>
      <div className="relative">
        <Carousel
          opts={{
            dragFree: true,
            containScroll: "trimSnaps",
          }}
          className="w-full"
        >
          <CarouselContent>
            {youtubeVideos.slice(0, 10).map((video: Video) => (
              <CarouselItem key={video.id} className="basis-1/2 sm:basis-1/3">
                <div className="w-full flex-shrink-0">
                  <div className="rounded-lg overflow-hidden mb-3 aspect-video bg-muted">
                    <iframe
                      src={`https://www.youtube.com/embed/${video.key}`}
                      title={video.name}
                      className="w-full h-full"
                      allowFullScreen
                      onError={() => handleVideoError(video.id, video.name)}
                    ></iframe>
                  </div>
                  <div className="text-center">
                    <h3 className="text-foreground font-medium text-sm mb-1 line-clamp-2">
                      {video.name}
                    </h3>
                    <p className="text-muted-foreground text-xs">
                      {video.type}
                    </p>
                  </div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="left-2 bg-background/80 hover:bg-background/90 border border-border text-foreground backdrop-blur-sm" />
          <CarouselNext className="right-2 bg-background/80 hover:bg-background/90 border border-border text-foreground backdrop-blur-sm" />
        </Carousel>
      </div>
    </section>
  );
}

type RecommendationsCarouselProps = {
  recommendations: (Movie | TvShow)[];
  mediaType: "movie" | "tv";
};

export function RecommendationsCarousel({
  recommendations,
  mediaType,
}: RecommendationsCarouselProps) {
  const router = useRouter();
  if (!recommendations.length) return null;

  const getTitle = (item: Movie | TvShow) => {
    return "title" in item ? item.title : item.name;
  };

  const getHref = (item: Movie | TvShow) => {
    const type = "title" in item ? "movies" : "tvshows";
    return `/${type}/${item.id}`;
  };

  const sectionTitle = mediaType === "movie" ? "Similar Movies" : "Recommended";

  return (
    <section>
      <h2 className="text-2xl font-semibold text-foreground mb-4">
        {sectionTitle}
      </h2>
      <div className="relative">
        <Carousel
          opts={{
            dragFree: true,
            containScroll: "trimSnaps",
          }}
          className="w-full"
        >
          <CarouselContent>
            {recommendations.slice(0, 20).map((item: Movie | TvShow) => (
              <CarouselItem
                key={item.id}
                className="basis-1/3 sm:basis-1/4 md:basis-1/5 lg:basis-1/6 xl:basis-1/8"
              >
                <div
                  className="w-full flex-shrink-0 hover:opacity-80 transition block"
                  onClick={() => {
                    router.push(getHref(item));
                  }}
                >
                  <div className="rounded-lg overflow-hidden mb-3 aspect-[2/3] bg-muted">
                    {item.poster_path ? (
                      <Image
                        src={`https://image.tmdb.org/t/p/w185${item.poster_path}`}
                        alt={getTitle(item)}
                        width={185}
                        height={278}
                        layout="responsive"
                        objectFit="cover"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <Tv size={48} />
                      </div>
                    )}
                  </div>
                  <div className="text-center">
                    <h3 className="text-foreground font-medium text-sm mb-1 line-clamp-2">
                      {getTitle(item)}
                    </h3>
                    <div className="flex items-center justify-center mt-1">
                      <Star size={12} className="text-yellow-500 mr-1" />
                      <span className="text-muted-foreground text-xs">
                        {item.vote_average?.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="left-2 bg-background/80 hover:bg-background/90 border border-border text-foreground backdrop-blur-sm" />
          <CarouselNext className="right-2 bg-background/80 hover:bg-background/90 border border-border text-foreground backdrop-blur-sm" />
        </Carousel>
      </div>
    </section>
  );
}
