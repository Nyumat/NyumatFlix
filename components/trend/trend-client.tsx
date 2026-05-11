"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  MovieWithMediaType,
  PersonWithMediaType,
  TvShowWithMediaType,
} from "@/tmdb/models";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { ContentCard } from "@/components/content/content-card";
import { MovieCard } from "@/components/movie/movie-card";
import { hasPosterPath, hasProfilePath } from "@/lib/media-poster-path";
import useMedia from "@/hooks/useMedia";
import { cn } from "@/lib/utils";
import { PersonCard } from "@/components/person/person-card";
import { TvCard } from "@/components/tv/tv-card";
import type { MediaItem } from "@/utils/typings";
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
  /**
   * tighter slides + poster cards with title/rating overlay (discover showcase rows).
   * when false, uses content cards with logo strip for trending/popular-style rows.
   */
  compact?: boolean;
  /** show title row with arrows (default true); set false when the page already has a heading */
  showToolbar?: boolean;
}

const carouselItemBasis = {
  default: "basis-1/2 md:basis-1/3 lg:basis-1/4 xl:basis-1/5",
  compact: "basis-[44%] sm:basis-1/4 md:basis-1/5 lg:basis-1/5 xl:basis-1/5",
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
  const visibleItems = useMemo(
    () =>
      items.filter((item) =>
        item.media_type === "person"
          ? hasProfilePath(item)
          : hasPosterPath(item),
      ),
    [items],
  );

  const [api, setApi] = useState<CarouselApi>();
  const [pageCount, setPageCount] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const isMobile = useMedia("(max-width: 768px)", false);

  useEffect(() => {
    if (!api) return;

    const sync = () => {
      const snaps = api.scrollSnapList();
      setPageCount(snaps.length);
      setPageIndex(api.selectedScrollSnap());
      setCanScrollPrev(api.canScrollPrev());
      setCanScrollNext(api.canScrollNext());
    };

    sync();
    api.on("select", sync);
    api.on("reInit", sync);

    return () => {
      api.off("select", sync);
      api.off("reInit", sync);
    };
  }, [api, visibleItems.length]);

  const handleCarouselNext = () => {
    api?.scrollNext();
  };

  const handleCarouselPrev = () => {
    api?.scrollPrev();
  };

  return (
    <Carousel
      opts={{
        align: "start",
        slidesToScroll: "auto",
        dragFree: true,
      }}
      setApi={setApi}
    >
      {showToolbar ? (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-md p-2 pr-3 md:justify-start md:gap-4 md:pr-4">
          {icon ? <div className="shrink-0">{icon}</div> : null}

          <div className="min-w-0 flex-1 md:mr-32">
            <h2 className="truncate text-lg font-medium md:text-base">
              {title}
            </h2>
            {description ? (
              <p className="hidden truncate text-sm text-muted-foreground xl:block">
                {description}
              </p>
            ) : null}
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
              More
            </Link>
          )}

          <div className="ml-4 hidden shrink-0 items-center gap-2 md:flex">
            {pageCount > 0 ? (
              <p
                className="mr-4 text-xs text-muted-foreground"
                aria-live="polite"
              >
                <span className="font-bold text-foreground">
                  {pageIndex + 1}
                </span>
                <span> / </span>
                <span>{pageCount}</span>
              </p>
            ) : null}

            <Button
              type="button"
              disabled={!canScrollPrev}
              onClick={handleCarouselPrev}
              size="sm"
              variant="outline"
              aria-label="Previous page of titles"
            >
              <ArrowLeft className="size-3" />
              <span className="sr-only">Previous page</span>
            </Button>
            <Button
              type="button"
              disabled={!canScrollNext}
              onClick={handleCarouselNext}
              size="sm"
              variant="outline"
              aria-label="Next page of titles"
            >
              <ArrowRight className="size-3" />
              <span className="sr-only">Next page</span>
            </Button>
          </div>
        </div>
      ) : null}

      <CarouselContent>
        {visibleItems.map((item) => (
          <CarouselItem
            key={item.id}
            className={
              compact ? carouselItemBasis.compact : carouselItemBasis.default
            }
          >
            {item.media_type === "tv" ? (
              compact ? (
                <TvCard {...item} />
              ) : (
                <ContentCard item={item as MediaItem} isMobile={isMobile} />
              )
            ) : item.media_type === "person" ? (
              <PersonCard key={item.id} {...item} />
            ) : compact ? (
              <MovieCard {...item} />
            ) : (
              <ContentCard item={item as MediaItem} isMobile={isMobile} />
            )}
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  );
};
