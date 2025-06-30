"use client";

import { MediaItem, isMovie, Movie, TvShow } from "@/utils/typings";
import Link from "next/link";
import useMedia from "@/hooks/useMedia";
import { ContentCard } from "./content-card";
import { ContentRowHeader } from "./content-row-header";
import { useEffect, useState, useRef } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";

// Interface to ensure item has an id property
interface ItemWithId {
  id: number;
}

// Note: ContentRowVariant might be defined elsewhere or become unnecessary if pages import specific rows.
// For now, we keep ContentRowProps similar, minus the variant prop for this specific component.
export interface StandardContentRowProps {
  title: string;
  items: MediaItem[];
  href: string;
  contentRating?: Record<number, string | null>;
  onLoadMore?: () => Promise<MediaItem[]>;
  hasMoreItems?: boolean;
}

export function StandardContentRow({
  title,
  items: initialItems,
  href,
  contentRating = {},
  onLoadMore,
  hasMoreItems = false,
}: StandardContentRowProps) {
  const isMobile = useMedia("(max-width: 768px)", false);
  const [items, setItems] = useState<MediaItem[]>(initialItems);
  const [loading, setLoading] = useState(false);
  const [api, setApi] = useState<CarouselApi>();
  const lastScrollProgressRef = useRef(0);

  useEffect(() => {
    if (
      initialItems.length > 0 &&
      items.length > 0 &&
      initialItems[0].id !== items[0].id
    ) {
      setItems(initialItems);
    } else if (initialItems.length > 0 && items.length === 0) {
      setItems(initialItems);
    }
  }, [initialItems, items]);

  // Handle scroll end detection for infinite loading
  useEffect(() => {
    if (!api || !hasMoreItems) return;

    const handleScroll = () => {
      const scrollProgress = api.scrollProgress();
      lastScrollProgressRef.current = scrollProgress;

      // When close to the end, load more items
      if (scrollProgress > 0.85 && !loading && hasMoreItems) {
        loadMoreItems();
      }
    };

    api.on("scroll", handleScroll);

    return () => {
      api.off("scroll", handleScroll);
    };
  }, [api, hasMoreItems, loading]);

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

  const getItemLink = (item: MediaItem): string => {
    const movieItem = isMovie(item) ? (item as unknown as Movie) : null;
    const tvShowItem = !isMovie(item) ? (item as unknown as TvShow) : null;

    if (movieItem) {
      return `/movies/${item.id}`;
    } else if (tvShowItem) {
      return `/tvshows/${item.id}`;
    } else {
      return `#invalid-item-${item.id}`;
    }
  };

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
          setApi={setApi}
          className="w-full"
        >
          <CarouselContent className="-ml-3 md:-ml-4">
            {items.map((item, index) => (
              <CarouselItem
                key={`${item.id}-${index}`}
                className="pl-3 md:pl-4 basis-[40%] sm:basis-[28%] md:basis-[22%] lg:basis-[18%] xl:basis-[12%]"
              >
                <Link href={getItemLink(item)} className="block group">
                  <ContentCard
                    item={item}
                    isMobile={!!isMobile}
                    rating={getContentRating(item)}
                  />
                </Link>
              </CarouselItem>
            ))}

            {hasMoreItems && loading && (
              <CarouselItem className="pl-3 md:pl-4 basis-[48%] sm:basis-[35%] md:basis-[28%] lg:basis-[22%] xl:basis-[18%] flex items-center justify-center">
                <LoadingSpinner />
              </CarouselItem>
            )}
          </CarouselContent>

          <CarouselPrevious className="absolute -left-3 md:-left-4 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm hover:bg-background/90 border-0" />
          <CarouselNext className="absolute -right-3 md:-right-4 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm hover:bg-background/90 border-0" />
        </Carousel>
      </div>
    </div>
  );
}
