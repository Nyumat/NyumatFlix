"use client";

import { Button } from "@/components/ui/button";
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import Fade from "embla-carousel-fade";
import { Info, Play } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { match, P } from "ts-pattern";
import { CarouselDetails } from "./carousel-details";
import { MediaCarouselProps } from "./types";

export function MediaCarousel({ items }: MediaCarouselProps) {
  const [mainCarouselApi, setMainCarouselApi] = useState<CarouselApi>();
  const [currentIndex, setCurrentIndex] = useState(0);
  const router = useRouter();

  useEffect(() => {
    if (!mainCarouselApi) return;

    const onSelect = () => {
      if (mainCarouselApi.selectedScrollSnap() !== currentIndex) {
        setCurrentIndex(mainCarouselApi.selectedScrollSnap());
      }
    };

    mainCarouselApi.on("select", onSelect);

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        mainCarouselApi.scrollNext();
      }
    }, 7000);

    return () => {
      mainCarouselApi.off("select", onSelect);
      clearInterval(interval);
    };
  }, [mainCarouselApi, currentIndex]);

  const handlePosterClick = (index: number) => {
    if (mainCarouselApi && index !== currentIndex) {
      setCurrentIndex(index);
      mainCarouselApi.scrollTo(index);
    }
  };

  return (
    <>
      <div className="relative hidden md:block">
        <Carousel
          className="w-full h-full"
          setApi={setMainCarouselApi}
          plugins={[Fade()]}
          opts={{ loop: true, duration: 50, containScroll: "trimSnaps" }}
        >
          <CarouselContent className="!ml-0 h-full">
            {items.map((item, index) => (
              <CarouselItem key={item.id} className="pl-0 h-full">
                <div className="relative w-full h-full z-50">
                  <Image
                    src={`https://image.tmdb.org/t/p/original${item.backdrop_path}`}
                    alt={match(item)
                      .with({ title: P.string }, (movie) => movie.title)
                      .with({ name: P.string }, (tvShow) => tvShow.name)
                      .otherwise(() => "Media Item")}
                    width={1920}
                    height={1080}
                    priority={index <= 2}
                    className="object-cover brightness-[0.7] z-50"
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
          setApi={setMainCarouselApi}
          plugins={[Fade()]}
          opts={{ loop: true, duration: 50, containScroll: "trimSnaps" }}
        >
          <CarouselContent className="!ml-0">
            {items.map((item, index) => (
              <CarouselItem key={item.id} className="pl-0">
                <div className="relative w-full h-56 sm:h-64 overflow-hidden shadow-2xl">
                  <Image
                    src={`https://image.tmdb.org/t/p/w780${item.backdrop_path}`}
                    alt={match(item)
                      .with({ title: P.string }, (movie) => movie.title)
                      .with({ name: P.string }, (tvShow) => tvShow.name)
                      .otherwise(() => "Media Item")}
                    fill
                    priority={index <= 2}
                    className="object-cover"
                    onError={(e) => {
                      console.error(
                        "Failed to load backdrop image:",
                        item.backdrop_path,
                      );
                      e.currentTarget.style.display = "none";
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

                  <div className="absolute bottom-6 left-6 right-6">
                    <h3 className="text-white text-xl sm:text-2xl font-bold mb-2 line-clamp-2 drop-shadow-lg">
                      {match(item)
                        .with({ title: P.string }, (movie) => movie.title)
                        .with({ name: P.string }, (tvShow) => tvShow.name)
                        .otherwise(() => "Media Item")}
                    </h3>
                    <p className="text-white/90 text-sm sm:text-base line-clamp-2 drop-shadow-md">
                      {item.overview}
                    </p>
                  </div>
                </div>
              </CarouselItem>
            ))}
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
                .with({ title: P.string }, (movie) => `/movies/${movie.id}`)
                .with({ name: P.string }, (tvShow) => `/tvshows/${tvShow.id}`)
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
                .with({ title: P.string }, (movie) => `/movies/${movie.id}`)
                .with({ name: P.string }, (tvShow) => `/tvshows/${tvShow.id}`)
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
