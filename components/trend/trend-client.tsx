"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  MovieWithMediaType,
  PersonWithMediaType,
  TvShowWithMediaType,
} from "@/tmdb/models";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { MovieCard } from "@/components/movie/movie-card";
import { PersonCard } from "@/components/person/person-card";
import { TvCard } from "@/components/tv/tv-card";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";

interface TrendCarouselProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  link?: string;
  items: MovieWithMediaType[] | TvShowWithMediaType[] | PersonWithMediaType[];
  type: "movie" | "tv" | "person";
  /** tighter carousel slides — more cards visible per row (e.g. catalog) */
  compact?: boolean;
  /** show title row with arrows (default true); set false when the page already has a heading */
  showToolbar?: boolean;
}

const carouselItemBasis = {
  default: "basis-1/2 md:basis-1/3 lg:basis-1/4 xl:basis-1/5",
  compact:
    "basis-1/3 sm:basis-1/4 md:basis-1/5 lg:basis-1/6 xl:basis-[14.285%]",
} as const;

export const TrendCarousel: React.FC<TrendCarouselProps> = ({
  title,
  description,
  icon,
  link,
  items,
  compact = false,
  showToolbar = true,
}) => {
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

  function nextSlide() {
    api?.scrollNext();
  }

  function previousSlide() {
    api?.scrollPrev();
  }

  return (
    <Carousel opts={{ dragFree: true }} setApi={setApi}>
      {showToolbar ? (
        <div className="mb-4 flex items-center justify-between gap-4 rounded-md p-2 pr-4 md:justify-start">
          {icon ? <div className="shrink-0">{icon}</div> : null}

          <div className="mr-32 w-full shrink truncate">
            <h2 className="font-xl">{title}</h2>
            <p className="hidden truncate text-sm text-muted-foreground xl:block">
              {description}
            </p>
          </div>

          {link && (
            <Link
              href={link}
              className={cn(
                buttonVariants({ size: "sm", variant: "outline" }),
                "ml-auto shrink-0",
              )}
              prefetch={false}
            >
              Explore more
            </Link>
          )}

          <div className="ml-4 hidden shrink-0 items-center gap-2 md:flex">
            <p className="mr-4 text-xs text-muted-foreground">
              <span className="font-bold text-foreground">{current}</span>
              <span> / </span>
              <span>{total}</span>
            </p>

            <Button onClick={previousSlide} size="sm" variant="outline">
              <ArrowLeft className="size-3" />
              <span className="sr-only">Previous</span>
            </Button>
            <Button onClick={nextSlide} size="sm" variant="outline">
              <ArrowRight className="size-3" />
              <span className="sr-only">Next</span>
            </Button>
          </div>
        </div>
      ) : null}

      <CarouselContent>
        {items.map((item) => (
          <CarouselItem
            key={item.id}
            className={
              compact ? carouselItemBasis.compact : carouselItemBasis.default
            }
          >
            {item.media_type === "tv" ? (
              <TvCard key={item.id} {...item} />
            ) : item.media_type === "person" ? (
              <PersonCard key={item.id} {...item} />
            ) : (
              <MovieCard key={item.id} {...item} />
            )}
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  );
};
