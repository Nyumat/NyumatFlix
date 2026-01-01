"use client";

import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import useMedia from "@/hooks/useMedia";
import { isMovie, isTVShow, MediaItem } from "@/utils/typings";
import { useEffect, useRef, useState } from "react";
import { ContentCard } from "./content-card";
import { ContentRowHeader } from "./content-row-header";

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
    // Use embedded content_rating first, then fallback to passed contentRating prop
    return item.content_rating || contentRating[item.id] || undefined;
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

  const LoadingComponent = () => (
    <div className="flex items-center justify-center min-h-[150px] w-full">
      <LoadingSpinner size="lg" />
    </div>
  );

  const getItemLink = (item: MediaItem): string => {
    if (isMovie(item)) {
      return `/movies/${(item as MediaItem).id}`;
    } else if (isTVShow(item)) {
      return `/tvshows/${(item as MediaItem).id}`;
    }
    return `/movies/${(item as MediaItem).id}`;
  };

  return (
    <div className="mx-4 md:mx-8 mb-8">
      <ContentRowHeader title={title} href={href} />

      <div className="relative -mx-10 p-2">
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
          <CarouselContent className="md:mx-0 px-4 md:px-0 w-full">
            {items.map((item, index) => (
              <CarouselItem
                key={`${item.id}-${index}`}
                className="pl-2 md:pl-3 basis-[45%] sm:basis-[32%] md:basis-[24%] lg:basis-[19%] xl:basis-[14%] p-2"
              >
                <ContentCard
                  item={item}
                  isMobile={!!isMobile}
                  rating={getContentRating(item)}
                  href={getItemLink(item)}
                />
              </CarouselItem>
            ))}

            {hasMoreItems && loading && (
              <CarouselItem className="pl-3 basis-[48%] sm:basis-[35%] flex items-center justify-center">
                <LoadingComponent />
              </CarouselItem>
            )}
          </CarouselContent>

          <CarouselPrevious className="absolute -left-3 md:left-4 top-1/2 -translate-y-1/2 bg-card/90 backdrop-blur-md hover:bg-primary/20 border-0 ring-1 ring-white/10 hover:ring-primary/40 shadow-lg shadow-black/20 transition-all duration-200" />
          <CarouselNext className="absolute -right-3 md:right-4 top-1/2 -translate-y-1/2 bg-card/90 backdrop-blur-md hover:bg-primary/20 border-0 ring-1 ring-white/10 hover:ring-primary/40 shadow-lg shadow-black/20 transition-all duration-200" />
        </Carousel>
      </div>
    </div>
  );
}
