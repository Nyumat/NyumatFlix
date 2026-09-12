"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import {
  MovieWithMediaType,
  PersonWithMediaType,
  TvShowWithMediaType,
} from "@/tmdb/models";
import { ContentCard } from "@/components/content/content-card";
import { MovieCard } from "@/components/movie/movie-card";
import { hasPosterPath, hasProfilePath } from "@/lib/media-poster-path";
import useMedia from "@/hooks/useMedia";
import { PersonCard } from "@/components/person/person-card";
import { TvCard } from "@/components/tv/tv-card";
import type { MediaItem } from "@/lib/domain/typings";
import { cn } from "@/lib/utils";
import { ChevronRight, ChevronUp } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type RecommendationSeedOption = {
  value: string;
  title: string;
};

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
  /** show title row (default true); set false when the page already has a heading */
  showToolbar?: boolean;
  /** Let homepage rails break out of the centered content container. */
  bleed?: boolean;
  recommendationSeedOptions?: RecommendationSeedOption[];
  selectedRecommendationSeed?: string;
  onRecommendationSeedChange?: (value: string) => void;
}

const carouselItemBasis = {
  default:
    "pl-3 basis-[46%] sm:basis-[31%] md:basis-[24%] lg:pl-4 lg:basis-[11rem] xl:basis-[12rem] 2xl:basis-[13rem]",
  compact:
    "pl-3 basis-[46%] sm:basis-[31%] md:basis-[24%] lg:pl-4 lg:basis-[11rem] xl:basis-[12rem] 2xl:basis-[13rem]",
} as const;

function RecommendationSeed({
  title,
  large = false,
  options,
  selectedValue,
  onValueChange,
}: {
  title: string;
  large?: boolean;
  options?: RecommendationSeedOption[];
  selectedValue?: string;
  onValueChange?: (value: string) => void;
}) {
  const seedOptions =
    options && options.length > 0 ? options : [{ value: title, title }];
  const activeValue = selectedValue ?? seedOptions[0]?.value ?? title;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "group/seed inline-flex min-w-0 max-w-[min(50vw,18rem)] shrink items-center gap-1 border-b-2 border-white/30 pb-0.5 font-semibold text-foreground transition-colors hover:border-white hover:text-white focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            large ? "text-2xl md:text-3xl" : "text-lg md:text-xl",
          )}
          aria-label={`Recommendation source: ${title}`}
        >
          <span className="truncate">{title}</span>
          <ChevronUp className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/seed:rotate-180" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="bottom"
        className="z-[60] max-h-[min(22rem,70vh)] w-72 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border-white/10 bg-zinc-900/95 p-1.5 text-white shadow-2xl shadow-black/40"
      >
        <DropdownMenuRadioGroup
          value={activeValue}
          onValueChange={(value) => {
            if (value !== activeValue) {
              onValueChange?.(value);
            }
          }}
        >
          {seedOptions.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              className="cursor-pointer rounded-xl py-3 pl-9 pr-3 text-base font-semibold text-white focus:bg-white/10 focus:text-white data-[state=checked]:bg-white/10"
            >
              <span className="truncate">{option.title}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const getTrendItemKey = (
  item: MovieWithMediaType | TvShowWithMediaType | PersonWithMediaType,
  index: number,
) => {
  const animeId =
    "sourceAnilistId" in item && typeof item.sourceAnilistId === "number"
      ? item.sourceAnilistId
      : undefined;

  return animeId
    ? `anilist-${animeId}`
    : `${item.media_type}-${item.id}-${index}`;
};

export const TrendCarousel: React.FC<TrendCarouselProps> = ({
  title,
  description,
  icon,
  link,
  items,
  compact = false,
  showToolbar = true,
  bleed = false,
  recommendationSeedOptions,
  selectedRecommendationSeed,
  onRecommendationSeedChange,
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

  const isMobile = useMedia("(max-width: 768px)", false);

  const carousel = (
    <Carousel
      className="group/row"
      opts={{
        align: "start",
        slidesToScroll: "auto",
        dragFree: true,
        containScroll: "trimSnaps",
      }}
    >
      {showToolbar ? (
        <div
          className={cn(
            "mb-4 flex min-w-0 items-baseline gap-3 md:gap-4",
            bleed ? "index-rail-padding" : "px-1 md:px-0",
          )}
        >
          {icon ? <div className="shrink-0">{icon}</div> : null}

          <div className="flex min-w-0 flex-1 items-baseline gap-2">
            <h2
              className={cn(
                "min-w-0 truncate whitespace-nowrap font-semibold tracking-tight",
                bleed ? "text-xl md:text-2xl" : "text-lg md:text-xl",
              )}
            >
              {title}
            </h2>
            {description ? (
              <RecommendationSeed
                title={description}
                large={bleed}
                options={recommendationSeedOptions}
                selectedValue={selectedRecommendationSeed}
                onValueChange={onRecommendationSeedChange}
              />
            ) : null}
          </div>

          {link && (
            <Link
              href={link}
              className="ml-auto inline-flex shrink-0 items-center gap-0.5 text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              prefetch={false}
            >
              <span>View all</span>
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          )}
        </div>
      ) : null}

      <CarouselContent
        className="-ml-3 lg:-ml-4"
        viewportClassName={bleed ? "index-rail-padding" : undefined}
      >
        {visibleItems.map((item, index) => (
          <CarouselItem
            key={getTrendItemKey(item, index)}
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

      <CarouselPrevious
        variant="ghost"
        className={cn(
          "hidden top-1/2 z-20 h-12 w-12 -translate-y-1/2 text-white opacity-0 drop-shadow-lg transition-all duration-300 hover:scale-110 hover:bg-transparent hover:text-white group-hover/row:opacity-100 group-focus-within/row:opacity-100 disabled:pointer-events-none disabled:opacity-0 lg:inline-flex",
          bleed ? "left-2" : "left-0",
        )}
        aria-label="Scroll left"
      />
      <CarouselNext
        variant="ghost"
        className={cn(
          "hidden top-1/2 z-20 h-12 w-12 -translate-y-1/2 text-white opacity-0 drop-shadow-lg transition-all duration-300 hover:scale-110 hover:bg-transparent hover:text-white group-hover/row:opacity-100 group-focus-within/row:opacity-100 disabled:pointer-events-none disabled:opacity-0 lg:inline-flex",
          bleed ? "right-2" : "right-0",
        )}
        aria-label="Scroll right"
      />
    </Carousel>
  );

  return bleed ? <div className="index-bleed">{carousel}</div> : carousel;
};
