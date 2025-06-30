"use client";

import { isMovie, MediaItem, Movie, TvShow } from "@/utils/typings";
import Link from "next/link";
import useMedia from "@/hooks/useMedia";
import { ContentCard } from "./content-card";
import { ContentRowHeader } from "./content-row-header";
import { useEffect, useState, useRef } from "react";
import Image from "next/legacy/image";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";
import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getGenreName } from "./genre-helpers";

// Props for the RankedContentRow, similar to StandardContentRowProps
export interface RankedContentRowProps {
  title: string;
  items: MediaItem[];
  href: string;
  contentRating?: Record<number, string | null>;
  onLoadMore?: () => Promise<MediaItem[]>;
  hasMoreItems?: boolean;
}

// Interface to ensure item has an id property
interface ItemWithId {
  id: number;
}

export function RankedContentRow({
  title,
  items: initialItems,
  href,
  contentRating = {},
  onLoadMore,
  hasMoreItems = false,
}: RankedContentRowProps) {
  const isMobile = useMedia("(max-width: 768px)", false);
  const [items, setItems] = useState<MediaItem[]>(initialItems);
  const [loading, setLoading] = useState(false);
  const [api, setApi] = useState<CarouselApi>();
  const lastScrollProgressRef = useRef(0);

  useEffect(() => {
    if (
      initialItems.length > 0 &&
      items.length > 0 &&
      initialItems[0]?.id !== items[0]?.id
    ) {
      setItems(initialItems);
    } else if (initialItems.length > 0 && items.length === 0) {
      setItems(initialItems);
    }
  }, [initialItems, items]);

  // Handle scroll end detection for infinite loading (mostly for mobile carousel)
  useEffect(() => {
    if (!api || !hasMoreItems || !isMobile) return; // Only apply to mobile carousel

    const handleScroll = () => {
      const scrollProgress = api.scrollProgress();
      lastScrollProgressRef.current = scrollProgress;

      if (scrollProgress > 0.85 && !loading && hasMoreItems) {
        loadMoreItems();
      }
    };

    api.on("scroll", handleScroll);

    return () => {
      api.off("scroll", handleScroll);
    };
  }, [api, hasMoreItems, loading, isMobile]);

  const getContentRating = (item: MediaItem & ItemWithId) => {
    return contentRating[item.id] || (isMovie(item) ? "PG" : "TV-14");
  };

  const loadMoreItems = async () => {
    if (onLoadMore && hasMoreItems && !loading) {
      setLoading(true);
      try {
        const newItems = await onLoadMore();
        if (newItems && newItems.length > 0) {
          setItems((prev) => [...prev, ...newItems]);
        }
      } catch (error) {
        console.error("Error loading more items:", error);
      } finally {
        setLoading(false);
      }
    }
  };

  const LoadingSpinner = () => (
    <div className="flex items-center justify-center min-h-[150px] w-full">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
    </div>
  );

  const getItemDetails = (item: MediaItem) => {
    // Create type-safe representations
    const movieItem = isMovie(item) ? (item as Movie) : null;
    const tvShowItem = !isMovie(item) ? (item as TvShow) : null;

    const displayTitle = movieItem
      ? movieItem.title
      : tvShowItem
        ? tvShowItem.name
        : "";
    const year =
      movieItem?.release_date?.substring(0, 4) ||
      tvShowItem?.first_air_date?.substring(0, 4);

    return { displayTitle, year };
  };

  // Mobile: Standard carousel of ranked cards
  if (isMobile) {
    return (
      <div className="mx-4 md:mx-8 mb-8">
        <ContentRowHeader title={title} href={href} />
        <div className="relative">
          <Carousel
            opts={{
              align: "start",
              loop: false,
              dragFree: true,
              skipSnaps: true,
            }}
            setApi={setApi} // setApi for mobile infinite scroll
            className="w-full"
          >
            <CarouselContent className="-ml-3">
              {items.map((item, index) => (
                <CarouselItem
                  key={`${item.id}-${index}`}
                  className="pl-3 md:pl-4 basis-[40%] sm:basis-[28%] md:basis-[22%] lg:basis-[18%] xl:basis-[12%]"
                >
                  <Link
                    href={`/${isMovie(item) ? "movies" : "tvshows"}/${item.id}`}
                    className="block group"
                  >
                    <div className="relative">
                      <div className="absolute top-0 left-0 z-10 flex items-center justify-center w-10 h-10 bg-neutral-900/90 text-white font-bold text-lg rounded-tl-md rounded-br-md">
                        {index + 1}
                      </div>
                      <ContentCard
                        item={item}
                        isMobile={true}
                        rating={getContentRating(item)}
                      />
                    </div>
                  </Link>
                </CarouselItem>
              ))}

              {hasMoreItems && loading && (
                <CarouselItem className="pl-3 basis-[48%] sm:basis-[35%] flex items-center justify-center">
                  <LoadingSpinner />
                </CarouselItem>
              )}
            </CarouselContent>
            <CarouselPrevious className="absolute -left-3 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm hover:bg-background/90 border-0 shadow-md" />
            <CarouselNext className="absolute -right-3 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm hover:bg-background/90 border-0 shadow-md" />
          </Carousel>
        </div>
      </div>
    );
  }

  // Desktop: Minimal, impactful, information-dense grid layout
  return (
    <div className="mx-4 md:mx-8 mb-12">
      <ContentRowHeader title={title} href={href} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-3 gap-y-4">
        {items.slice(0, 8).map((item, index) => {
          const { displayTitle, year } = getItemDetails(item);
          const genres =
            item.genre_ids?.slice(0, 1).map((id) => getGenreName(id)) || []; // Show only the primary genre for density

          return (
            <Link
              key={`${item.id}-${index}`}
              href={`/${isMovie(item) ? "movies" : "tvshows"}/${item.id}`}
              className="flex group relative overflow-hidden rounded-md hover:bg-neutral-800/60 transition-colors duration-200 p-2 items-center"
            >
              {/* Rank number */}
              <div className="flex items-center justify-center w-12 shrink-0">
                <span
                  className={cn(
                    "text-4xl xl:text-5xl font-medium",
                    index === 0
                      ? "text-primary font-semibold"
                      : "text-neutral-500 group-hover:text-primary/80 transition-colors duration-200",
                  )}
                >
                  {index + 1}
                </span>
              </div>

              {/* Poster */}
              <div className="relative overflow-hidden rounded h-20 w-14 sm:h-24 sm:w-16 shrink-0 mx-2">
                <Image
                  src={`https://image.tmdb.org/t/p/w154${item.poster_path}`}
                  alt={displayTitle || "Media poster"}
                  layout="fill"
                  objectFit="cover"
                  className="transition-transform duration-300 group-hover:scale-105"
                />
              </div>

              {/* Text details */}
              <div className="flex flex-col justify-center flex-1 min-w-0">
                <h3 className="font-semibold text-sm sm:text-base text-neutral-100 truncate group-hover:text-white transition-colors duration-200">
                  {displayTitle}
                </h3>

                <div className="flex flex-wrap items-center text-xs text-neutral-400 mt-0.5">
                  <div className="flex items-center mr-1.5">
                    <Star
                      className="w-3 h-3 text-yellow-400 mr-0.5"
                      fill="currentColor"
                    />
                    <span>{item.vote_average?.toFixed(1)}</span>
                  </div>
                  {year && <span className="mr-1.5">• {year}</span>}
                  {genres.length > 0 && (
                    <span className="truncate hidden sm:inline">
                      • {genres.join(", ")}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 mt-1">
                  <Badge
                    variant="outline"
                    className="text-[10px] py-0 h-4 px-1.5 border-neutral-700 text-neutral-400 group-hover:border-neutral-600 group-hover:text-neutral-300 transition-colors duration-200"
                  >
                    {isMovie(item) ? "Movie" : "TV"}
                  </Badge>
                  {getContentRating(item) && (
                    <Badge
                      variant="outline"
                      className="text-[10px] py-0 h-4 px-1.5 border-neutral-700 text-neutral-400 group-hover:border-neutral-600 group-hover:text-neutral-300 transition-colors duration-200"
                    >
                      {getContentRating(item)}
                    </Badge>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {hasMoreItems && !isMobile && (
        <div className="flex justify-center mt-8">
          {loading ? (
            <LoadingSpinner />
          ) : (
            <button
              onClick={loadMoreItems}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-md text-sm text-neutral-300 hover:text-white transition-colors duration-200"
            >
              Load More Ranked
            </button>
          )}
        </div>
      )}
    </div>
  );
}
