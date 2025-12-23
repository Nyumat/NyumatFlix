"use client";

import { getGenreNames } from "@/components/content/genre-helpers";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import Fade from "embla-carousel-fade";
import { Info, Play, Star } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { match, P } from "ts-pattern";
import { Poster } from "../media/media-poster";
import { CarouselDetails } from "./carousel-details";
import { MediaCarouselProps } from "./types";

export function MediaCarousel({ items }: MediaCarouselProps) {
  const [desktopCarouselApi, setDesktopCarouselApi] = useState<CarouselApi>();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [expandedOverview, setExpandedOverview] = useState<
    Record<number, boolean>
  >({});
  const router = useRouter();

  const getMediaType = (item: (typeof items)[0]) => {
    return match(item)
      .with({ title: P.string }, () => "movie" as const)
      .with({ name: P.string }, () => "tv" as const)
      .otherwise(() => "movie" as const);
  };

  const toggleOverview = (itemId: number) => {
    setExpandedOverview((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  useEffect(() => {
    if (desktopCarouselApi) {
      const onSelect = () => {
        const newIndex = desktopCarouselApi.selectedScrollSnap();
        setCurrentIndex(newIndex);
      };

      desktopCarouselApi.on("select", onSelect);

      const interval = setInterval(() => {
        if (document.visibilityState === "visible") {
          desktopCarouselApi.scrollNext();
        }
      }, 7000);

      return () => {
        desktopCarouselApi.off("select", onSelect);
        clearInterval(interval);
      };
    }

    if (window.innerWidth < 768) {
      const interval = setInterval(() => {
        if (document.visibilityState === "visible") {
          setCurrentIndex((prevIndex) => (prevIndex + 1) % items.length);
        }
      }, 7000);

      return () => clearInterval(interval);
    }
  }, [desktopCarouselApi, items.length]);

  const handlePosterClick = (index: number) => {
    if (desktopCarouselApi && index !== currentIndex) {
      setCurrentIndex(index);
      desktopCarouselApi.scrollTo(index);
    } else if (index !== currentIndex) {
      setCurrentIndex(index);
    }
  };

  return (
    <>
      <div className="relative hidden md:block">
        <Carousel
          className="w-full h-full"
          setApi={setDesktopCarouselApi}
          plugins={[Fade()]}
          opts={{ loop: true, duration: 50, containScroll: "trimSnaps" }}
        >
          <CarouselContent className="!ml-0 h-full">
            {items.map((item, index) => (
              <CarouselItem key={item.id} className="pl-0 h-full">
                <div className="relative w-full h-full z-50">
                  <Image
                    key={`backdrop-${item.id}-${index}`}
                    src={`https://image.tmdb.org/t/p/original${item.backdrop_path}`}
                    alt={match(item)
                      .with({ title: P.string }, (movie) => movie.title)
                      .with({ name: P.string }, (tvShow) => tvShow.name)
                      .otherwise(() => "Media Item")}
                    width={1920}
                    height={1080}
                    priority={index <= 2}
                    className="object-cover brightness-[0.3] z-50 w-full h-full"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        <CarouselDetails
          current={items[currentIndex]}
          items={items}
          onPosterClick={handlePosterClick}
        />

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 hidden md:flex space-x-2 z-10">
          {items.map((_, index) => (
            <button
              key={index}
              onClick={() => handlePosterClick(index)}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                currentIndex === index ? "w-4 bg-primary" : "bg-white/50"
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </div>

      <div className="relative md:hidden pt-20 pb-4">
        <div className="w-full animate-in fade-in duration-500">
          {(() => {
            const currentItem = items[currentIndex];
            const mediaType = getMediaType(currentItem);
            const genres = getGenreNames(currentItem.genre_ids, mediaType);
            const year = match(currentItem)
              .with({ title: P.string, release_date: P.string }, (movie) =>
                new Date(movie.release_date).getFullYear().toString(),
              )
              .with({ name: P.string, first_air_date: P.string }, (tvShow) =>
                new Date(tvShow.first_air_date).getFullYear().toString(),
              )
              .otherwise(() => "");

            const isExpanded = expandedOverview[currentItem.id] || false;
            const shouldShowReadMore =
              currentItem.overview && currentItem.overview.length > 100;

            return (
              <div className="px-4 w-full">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-24 sm:w-28 mt-4">
                    <Poster
                      posterPath={currentItem.poster_path ?? undefined}
                      title={match(currentItem)
                        .with({ title: P.string }, (movie) => movie.title)
                        .with({ name: P.string }, (tvShow) => tvShow.name)
                        .otherwise(() => "Media Item")}
                      size="small"
                      className="rounded-md bg-muted"
                    />
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-between py-2">
                    <div>
                      <h3 className="text-white text-lg sm:text-xl font-bold mb-2 drop-shadow-lg line-clamp-2">
                        {match(currentItem)
                          .with({ title: P.string }, (movie) => movie.title)
                          .with({ name: P.string }, (tvShow) => tvShow.name)
                          .otherwise(() => "Media Item")}
                      </h3>
                      <div className="flex items-center gap-2 mb-2 text-white/90 text-xs">
                        {currentItem.content_rating && (
                          <span className="px-1.5 py-0.5 bg-white/20 rounded text-[10px] font-medium border border-white/30">
                            {currentItem.content_rating}
                          </span>
                        )}
                        <div className="flex items-center gap-1">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          <span className="font-medium">
                            {currentItem.vote_average.toFixed(1)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mb-3 text-white/80 text-xs flex-wrap">
                        {year && <span>{year}</span>}
                        {year && genres.length > 0 && <span>•</span>}
                        {genres.length > 0 && (
                          <span className="truncate">
                            {genres.slice(0, 2).join(" / ")}
                          </span>
                        )}
                        {mediaType === "tv" &&
                          typeof currentItem.number_of_seasons === "number" &&
                          currentItem.number_of_seasons > 0 && (
                            <>
                              <span>•</span>
                              <span>
                                {currentItem.number_of_seasons} Season
                                {currentItem.number_of_seasons !== 1 ? "s" : ""}
                              </span>
                            </>
                          )}
                      </div>
                      {currentItem.overview && (
                        <div className="mb-2">
                          <p className="text-white/90 text-xs leading-relaxed line-clamp-3">
                            {isExpanded || !shouldShowReadMore
                              ? currentItem.overview
                              : `${currentItem.overview.substring(0, 100)}...`}
                          </p>
                          {shouldShowReadMore && (
                            <button
                              onClick={() => toggleOverview(currentItem.id)}
                              className="text-white/80 text-xs font-medium mt-1 hover:text-orange-400 transition-colors"
                            >
                              {isExpanded ? "Read less" : "Read more"}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        <div className="flex justify-center space-x-2 mt-4">
          {items.map((_, index) => (
            <button
              key={index}
              onClick={() => handlePosterClick(index)}
              className={`h-2 rounded-full transition-all duration-300 ${
                currentIndex === index
                  ? "w-8 bg-white"
                  : "w-2 bg-white/40 hover:bg-white/60"
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>

        <div className="flex justify-center gap-3 px-4 mt-4">
          <Button
            onClick={() => {
              const current = items[currentIndex];
              const href = match(current)
                .with(
                  { title: P.string, id: P.number },
                  (movie) => `/movies/${movie.id}`,
                )
                .with(
                  { name: P.string, id: P.number },
                  (tvShow) => `/tvshows/${tvShow.id}`,
                )
                .otherwise(() => "#");
              router.push(`${href}?autoplay=true`);
            }}
            size="lg"
            variant="outline"
            className="bg-white/10 backdrop-blur-sm text-white border-white/30 hover:bg-white/20 flex-1"
          >
            <Play className="mr-2 h-4 w-4" />
            Play
          </Button>
          <Button
            onClick={() => {
              const current = items[currentIndex];
              const href = match(current)
                .with(
                  { title: P.string, id: P.number },
                  (movie) => `/movies/${movie.id}`,
                )
                .with(
                  { name: P.string, id: P.number },
                  (tvShow) => `/tvshows/${tvShow.id}`,
                )
                .otherwise(() => "#");
              router.push(href);
            }}
            size="default"
            variant="outline"
            className="bg-white/10 backdrop-blur-sm text-white border-white/30 hover:bg-white/20"
          >
            <Info className="mr-2 h-4 w-4" />
            More Info
          </Button>
        </div>
      </div>
    </>
  );
}
