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
import { CarouselDetails } from "./carousel-details";
import { MediaCarouselProps } from "./types";

export function MediaCarousel({ items }: MediaCarouselProps) {
  const [desktopCarouselApi, setDesktopCarouselApi] = useState<CarouselApi>();
  const [mobileCarouselApi, setMobileCarouselApi] = useState<CarouselApi>();
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
    const activeApi = desktopCarouselApi || mobileCarouselApi;
    if (!activeApi) return;

    const onSelect = () => {
      const newIndex = activeApi.selectedScrollSnap();
      setCurrentIndex(newIndex);
    };

    activeApi.on("select", onSelect);

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        activeApi.scrollNext();
      }
    }, 7000);

    return () => {
      activeApi.off("select", onSelect);
      clearInterval(interval);
    };
  }, [desktopCarouselApi, mobileCarouselApi]);

  const handlePosterClick = (index: number) => {
    const activeApi = desktopCarouselApi || mobileCarouselApi;
    if (activeApi && index !== currentIndex) {
      setCurrentIndex(index);
      activeApi.scrollTo(index);
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
                    className="object-cover brightness-[0.5] z-50"
                    onError={(e) => {
                      console.error(
                        "Failed to load backdrop image:",
                        item.backdrop_path,
                      );
                      e.currentTarget.style.display = "none";
                    }}
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
        <Carousel
          className="w-full"
          setApi={setMobileCarouselApi}
          plugins={[Fade()]}
          opts={{ loop: true, duration: 50, containScroll: "trimSnaps" }}
        >
          <CarouselContent className="!ml-0">
            {items.map((item) => {
              const mediaType = getMediaType(item);
              const genres = getGenreNames(item.genre_ids, mediaType);
              const year = match(item)
                .with({ title: P.string, release_date: P.string }, (movie) =>
                  new Date(movie.release_date).getFullYear().toString(),
                )
                .with({ name: P.string, first_air_date: P.string }, (tvShow) =>
                  new Date(tvShow.first_air_date).getFullYear().toString(),
                )
                .otherwise(() => "");

              const isExpanded = expandedOverview[item.id] || false;
              const shouldShowReadMore =
                item.overview && item.overview.length > 120;

              return (
                <CarouselItem key={item.id} className="pl-0">
                  <div className="relative w-full h-80 sm:h-96 overflow-hidden shadow-2xl">
                    <Image
                      src={`https://image.tmdb.org/t/p/w780${item.backdrop_path}`}
                      alt={match(item)
                        .with({ title: P.string }, (movie) => movie.title)
                        .with({ name: P.string }, (tvShow) => tvShow.name)
                        .otherwise(() => "Media Item")}
                      fill
                      priority={true}
                      className="object-cover brightness-[0.5]"
                      onError={(e) => {
                        console.error(
                          "Failed to load backdrop image:",
                          item.backdrop_path,
                        );
                        e.currentTarget.style.display = "none";
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />

                    {/* Content overlay */}
                    <div className="absolute inset-0 flex flex-col justify-end p-6">
                      {/* Title */}
                      <h3 className="text-white text-2xl sm:text-3xl font-bold mb-3 drop-shadow-lg">
                        {match(item)
                          .with({ title: P.string }, (movie) => movie.title)
                          .with({ name: P.string }, (tvShow) => tvShow.name)
                          .otherwise(() => "Media Item")}
                      </h3>

                      {/* Metadata row */}
                      <div className="flex items-center gap-3 mb-3 text-white/90 text-sm">
                        {/* Content rating */}
                        {item.content_rating && (
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-1 bg-white/20 rounded text-xs font-medium border border-white/30">
                              {item.content_rating}
                            </span>
                          </div>
                        )}

                        {/* Rating */}
                        <div className="flex items-center gap-1">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          <span className="font-medium">
                            {item.vote_average.toFixed(1)}
                          </span>
                        </div>
                      </div>

                      {/* Year and genres */}
                      <div className="flex items-center gap-2 mb-4 text-white/80 text-sm">
                        {year && <span>{year}</span>}
                        {year && genres.length > 0 && <span>•</span>}
                        {genres.length > 0 && (
                          <span>{genres.slice(0, 2).join(" / ")}</span>
                        )}
                        {mediaType === "tv" &&
                          typeof item.number_of_seasons === "number" &&
                          item.number_of_seasons > 0 && (
                            <>
                              <span>•</span>
                              <span>
                                {item.number_of_seasons} Season
                                {item.number_of_seasons !== 1 ? "s" : ""}
                              </span>
                            </>
                          )}
                      </div>

                      {/* Overview */}
                      {item.overview && (
                        <div className="mb-4">
                          <p className="text-white/90 text-sm leading-relaxed">
                            {isExpanded || !shouldShowReadMore
                              ? item.overview
                              : `${item.overview.substring(0, 120)}...`}
                          </p>
                          {shouldShowReadMore && (
                            <button
                              onClick={() => toggleOverview(item.id)}
                              className="text-white text-sm font-medium mt-1 hover:text-orange-400 transition-colors"
                            >
                              {isExpanded ? "Read less" : "Read more"}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CarouselItem>
              );
            })}
          </CarouselContent>
        </Carousel>

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
