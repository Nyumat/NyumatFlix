"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { MovieWithMediaType, TvShowWithMediaType } from "@/tmdb/models";
import { MovieCard } from "@/components/movie/movie-card";
import { TvCard } from "@/components/tv/tv-card";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";
import { MediaItem } from "@/utils/typings";
import { RankedBackdropCard } from "./ranked-backdrop-card";

const carouselItemBasis = "basis-1/2 md:basis-1/3 lg:basis-1/4 xl:basis-1/5";

export interface TopRatedFeaturedCarouselProps {
  title: string;
  description: string;
  link: string;
  topThree: MediaItem[];
  carouselItems: MovieWithMediaType[] | TvShowWithMediaType[];
  type: "movie" | "tv";
}

export const TopRatedFeaturedCarousel = ({
  title,
  description,
  link,
  topThree,
  carouselItems,
  type,
}: TopRatedFeaturedCarouselProps) => {
  const [api, setApi] = useState<CarouselApi>();
  const [total, setTotal] = useState(0);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!api) return;

    setTotal(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap() + 1);

    api.on("select", () => {
      setCurrent(api.selectedScrollSnap() + 1);
    });
  }, [api]);

  const handleNextSlide = () => {
    api?.scrollNext();
  };

  const handlePreviousSlide = () => {
    api?.scrollPrev();
  };

  const strip = topThree.slice(0, 3);

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="relative overflow-hidden rounded-xl border border-white/6 bg-linear-to-b from-muted/30 to-muted/5 p-4 shadow-inner shadow-black/20 md:p-5">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          aria-hidden
          style={{
            backgroundImage:
              "radial-gradient(ellipse 80% 50% at 50% -20%, hsl(var(--primary) / 0.25), transparent 55%)",
          }}
        />

        <div className="relative">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Top chart
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
                {title}
              </h2>
              {description ? (
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  {description}
                </p>
              ) : null}
            </div>

            {link ? (
              <Link
                href={link}
                className={cn(
                  buttonVariants({ size: "sm", variant: "outline" }),
                  "shrink-0 self-start",
                )}
                prefetch={false}
              >
                More
              </Link>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
            {strip.map((item, index) => (
              <RankedBackdropCard
                key={`${item.id}-${index}`}
                item={item}
                rank={index + 1}
              />
            ))}
          </div>
        </div>
      </div>

      {carouselItems.length > 0 ? (
        <Carousel opts={{ dragFree: true }} setApi={setApi}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-medium text-muted-foreground">
              More highly rated {type === "movie" ? "films" : "series"}
            </h3>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <p className="mr-2 text-xs text-muted-foreground">
                <span className="font-bold text-foreground">{current}</span>
                <span> / </span>
                <span>{total}</span>
              </p>
              <Button
                onClick={handlePreviousSlide}
                size="sm"
                variant="outline"
                type="button"
                aria-label="Previous slide"
              >
                <ArrowLeft className="size-3" />
              </Button>
              <Button
                onClick={handleNextSlide}
                size="sm"
                variant="outline"
                type="button"
                aria-label="Next slide"
              >
                <ArrowRight className="size-3" />
              </Button>
            </div>
          </div>

          <CarouselContent className="-ml-2 md:-ml-4">
            {carouselItems.map((item) => (
              <CarouselItem
                key={item.id}
                className={cn("pl-2 md:pl-4", carouselItemBasis)}
              >
                {item.media_type === "tv" ? (
                  <TvCard {...item} />
                ) : (
                  <MovieCard {...item} />
                )}
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      ) : null}
    </div>
  );
};
