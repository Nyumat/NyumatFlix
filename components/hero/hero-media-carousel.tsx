"use client";

import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import Fade from "embla-carousel-fade";
import Image from "next/image";
import { useEffect, useState } from "react";
import { match, P } from "ts-pattern";
import { CarouselDetails } from "./hero-carousel-details";
import { MediaCarouselProps } from "./types";

export function MediaCarousel({ items }: MediaCarouselProps) {
  const [mainCarouselApi, setMainCarouselApi] = useState<CarouselApi>();
  const [currentIndex, setCurrentIndex] = useState(0);

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
    <div className="relative">
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

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-2 z-10">
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
  );
}
