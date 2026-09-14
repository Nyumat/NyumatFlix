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
import {
  carouselItemClassName,
  filterCatalogCardArt,
  useCatalogCardStyle,
} from "@/lib/catalog-card-presentation";
import { hasProfilePath } from "@/lib/media-poster-path";
import useMedia from "@/hooks/useMedia";
import { PersonCard } from "@/components/person/person-card";
import { TvCard } from "@/components/tv/tv-card";
import type { MediaItem } from "@/lib/domain/typings";
import { contentRowActionLinkClassName } from "@/lib/content-row-action-link";
import { contentRowSelectTriggerClassName } from "@/lib/content-row-select-trigger";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  /** Rail viewport padding when `bleed` is false but the parent already bleeds. */
  railPadding?: boolean;
  recommendationSeedOptions?: RecommendationSeedOption[];
  selectedRecommendationSeed?: string;
  onRecommendationSeedChange?: (value: string) => void;
  heading?: React.ReactNode;
  trailing?: React.ReactNode;
}

export function RecommendationSeed({
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
  const activeTitle =
    seedOptions.find((option) => option.value === activeValue)?.title ?? title;
  const lastOptionIndex = seedOptions.length - 1;

  const groupedSelectItemClassName = (index: number) => {
    if (lastOptionIndex === 0) {
      return "rounded-xl";
    }
    if (index === 0) {
      return "rounded-t-xl rounded-b-none";
    }
    if (index === lastOptionIndex) {
      return "rounded-b-xl rounded-t-none";
    }
    return "rounded-none";
  };

  return (
    <Select
      value={activeValue}
      onValueChange={(value) => {
        if (value !== activeValue) {
          onValueChange?.(value);
        }
      }}
    >
      <SelectTrigger
        aria-label={`Recommendation source: ${activeTitle}`}
        className={contentRowSelectTriggerClassName(large)}
      >
        <SelectValue placeholder={title} />
      </SelectTrigger>
      <SelectContent
        align="start"
        side="bottom"
        position="popper"
        size="long-list"
        avoidCollisions={false}
        sideOffset={10}
        className="z-[60] min-w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border-border/70 p-0 shadow-xl backdrop-blur-xl [&_[data-radix-select-viewport]]:p-0"
      >
        {seedOptions.map((option, index) => (
          <SelectItem
            key={option.value}
            value={option.value}
            className={cn(
              "cursor-pointer py-2.5 pl-8 pr-3 font-medium focus:bg-accent/90 data-[highlighted]:bg-accent/90 data-[state=checked]:bg-accent/50 data-[state=checked]:font-semibold",
              groupedSelectItemClassName(index),
              large ? "text-base" : "text-sm",
            )}
          >
            {option.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
  railPadding,
  recommendationSeedOptions,
  selectedRecommendationSeed,
  onRecommendationSeedChange,
  heading,
  trailing,
}) => {
  const catalogCardStyle = useCatalogCardStyle();
  const visibleItems = useMemo(
    () =>
      items.filter((item) =>
        item.media_type === "person"
          ? hasProfilePath(item)
          : filterCatalogCardArt([item], catalogCardStyle).length > 0,
      ),
    [catalogCardStyle, items],
  );

  const isMobile = useMedia("(max-width: 768px)", false);
  const useRailPadding = railPadding ?? bleed;

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
            "mb-4 flex min-w-0 gap-3 md:gap-4",
            heading || trailing ? "items-end" : "items-baseline",
            heading && trailing ? "justify-between gap-x-4" : null,
            useRailPadding ? "index-rail-padding" : "px-1 md:px-0",
          )}
        >
          {icon ? <div className="shrink-0">{icon}</div> : null}

          <div
            className={cn(
              "flex gap-2",
              heading
                ? "min-w-0 w-fit max-w-full shrink-0 items-end"
                : "min-w-0 flex-1 items-baseline",
            )}
          >
            {heading ?? (
              <>
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
              </>
            )}
          </div>

          {trailing ??
            (link ? (
              <Link
                href={link}
                className={contentRowActionLinkClassName}
                prefetch={false}
              >
                <span>View all</span>
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            ) : null)}
        </div>
      ) : null}

      <CarouselContent
        className="-ml-3 lg:-ml-4"
        viewportClassName={useRailPadding ? "index-rail-padding" : undefined}
      >
        {visibleItems.map((item, index) => (
          <CarouselItem
            key={getTrendItemKey(item, index)}
            className={carouselItemClassName(catalogCardStyle)}
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
          useRailPadding ? "left-2" : "left-0",
        )}
        aria-label="Scroll left"
      />
      <CarouselNext
        variant="ghost"
        className={cn(
          "hidden top-1/2 z-20 h-12 w-12 -translate-y-1/2 text-white opacity-0 drop-shadow-lg transition-all duration-300 hover:scale-110 hover:bg-transparent hover:text-white group-hover/row:opacity-100 group-focus-within/row:opacity-100 disabled:pointer-events-none disabled:opacity-0 lg:inline-flex",
          useRailPadding ? "right-2" : "right-0",
        )}
        aria-label="Scroll right"
      />
    </Carousel>
  );

  return bleed ? <div className="index-bleed">{carousel}</div> : carousel;
};
