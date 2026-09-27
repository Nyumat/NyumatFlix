"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import {
  type CatalogMediaCard,
  isCatalogMediaCard,
  toCanonicalHubCard,
} from "@/lib/cards/catalog-dto";
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
import {
  CatalogHubRow,
  CatalogHubRowToolbar,
} from "@/components/catalog/catalog-hub-row";
import { contentRowActionLinkClassName } from "@/lib/content-row-action-link";
import { contentRowSelectTriggerClassName } from "@/lib/content-row-select-trigger";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import { CarouselItem } from "@/components/ui/carousel";
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
  items:
    | MovieWithMediaType[]
    | TvShowWithMediaType[]
    | PersonWithMediaType[]
    | CatalogMediaCard[];
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

type TrendCarouselItem =
  | MovieWithMediaType
  | TvShowWithMediaType
  | PersonWithMediaType
  | CatalogMediaCard;

const getTrendItemKey = (item: TrendCarouselItem, index: number) => {
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

  const toolbarHeader = showToolbar ? (
    <CatalogHubRowToolbar
      bleed={bleed}
      railPadding={useRailPadding}
      icon={icon}
      heading={heading}
      title={title}
      titleAddon={
        description ? (
          <RecommendationSeed
            title={description}
            large={bleed}
            options={recommendationSeedOptions}
            selectedValue={selectedRecommendationSeed}
            onValueChange={onRecommendationSeedChange}
          />
        ) : undefined
      }
      trailing={
        trailing ??
        (link ? (
          <Link href={link} className={contentRowActionLinkClassName}>
            <span>View all</span>
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        ) : undefined)
      }
      toolbar={Boolean(heading && trailing)}
    />
  ) : undefined;

  const carouselItems = visibleItems.map((item, index) => (
    <CarouselItem
      key={getTrendItemKey(item, index)}
      className={carouselItemClassName(catalogCardStyle)}
    >
      {item.media_type === "tv" ? (
        isCatalogMediaCard(item) ? (
          <ContentCard item={toCanonicalHubCard(item)} isMobile={isMobile} />
        ) : compact ? (
          <TvCard {...item} />
        ) : (
          <ContentCard item={item as MediaItem} isMobile={isMobile} />
        )
      ) : item.media_type === "person" ? (
        <PersonCard key={item.id} {...item} />
      ) : isCatalogMediaCard(item) ? (
        <ContentCard item={toCanonicalHubCard(item)} isMobile={isMobile} />
      ) : compact ? (
        <MovieCard {...item} />
      ) : (
        <ContentCard item={item as MediaItem} isMobile={isMobile} />
      )}
    </CarouselItem>
  ));

  return (
    <CatalogHubRow
      ariaLabel={title ?? "Catalog row"}
      bleed={bleed}
      railPadding={useRailPadding}
      header={toolbarHeader}
    >
      {carouselItems}
    </CatalogHubRow>
  );
};
