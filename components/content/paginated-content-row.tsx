"use client";

import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { EnhancedLink } from "@/components/ui/enhanced-link";
import { getRating, useContentRatings } from "@/hooks/useContentRatings";
import { useIntersectionPrefetch } from "@/hooks/useIntersectionPrefetch";
import useMedia from "@/hooks/useMedia";
import { MediaItem, isMovie } from "@/utils/typings";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { ContentCard } from "./content-card";
import { ContentRowHeader } from "./content-row-header";

export interface PaginatedContentRowProps {
  title: string;
  items: MediaItem[];
  href: string;
  onLoadMore?: () => Promise<MediaItem[]>;
  hasMoreItems?: boolean;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  isLoadingMore?: boolean;
}

function PaginatedContentItem({
  item,
  index,
}: {
  item: MediaItem;
  index: number;
}) {
  const href = `/${isMovie(item) ? "movies" : "tvshows"}/${item.id}`;
  const mediaType = isMovie(item) ? "movie" : "tv";

  // Use intersection observer for items that are not immediately visible
  const elementRef = useIntersectionPrefetch(href, mediaType, item.id, {
    rootMargin: "100px",
  });

  return (
    <CarouselItem
      ref={elementRef}
      key={`${item.id}-${index}`}
      className="pl-3 md:pl-4 basis-[40%] sm:basis-[28%] md:basis-[22%] lg:basis-[18%] xl:basis-[12%]"
    >
      <EnhancedLink
        href={href}
        className="block group"
        mediaItem={item}
        prefetchDelay={100}
      >
        <ContentCard item={item} isMobile={false} rating="" />
      </EnhancedLink>
    </CarouselItem>
  );
}

export function PaginatedContentRow({
  title,
  items: initialItems,
  href,
  onLoadMore,
  hasMoreItems = false,
  currentPage,
  totalPages,
  onPageChange,
  isLoadingMore = false,
}: PaginatedContentRowProps) {
  const isMobile = useMedia("(max-width: 768px)", false);
  const [items, setItems] = useState<MediaItem[]>(initialItems);
  const [loading, setLoading] = useState(false);

  // Fetch actual ratings for the items
  const { ratings: fetchedRatings, loading: ratingsLoading } =
    useContentRatings(items);

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

  const loadMoreItems = async () => {
    if (onLoadMore && hasMoreItems && !loading && !isLoadingMore) {
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

  const getContentRating = (item: MediaItem) => {
    return getRating(item, fetchedRatings);
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  const LoadingSpinner = () => (
    <div className="flex items-center justify-center min-h-[150px] w-full">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
    </div>
  );

  return (
    <div className="mx-4 md:mx-8 mb-8">
      <ContentRowHeader title={title} href={href} />

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevPage}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNextPage}
            disabled={currentPage === totalPages}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="relative">
        <Carousel
          opts={{
            align: "start",
            loop: false,
            dragFree: true,
            skipSnaps: true,
          }}
          className="w-full"
        >
          <CarouselContent className="-ml-3 md:-ml-4">
            {items.map((item, index) => (
              <CarouselItem
                key={`${item.id}-${index}`}
                className="pl-3 md:pl-4 basis-[40%] sm:basis-[28%] md:basis-[22%] lg:basis-[18%] xl:basis-[12%]"
              >
                <EnhancedLink
                  href={`/${isMovie(item) ? "movies" : "tvshows"}/${item.id}`}
                  className="block group"
                  mediaItem={item}
                  prefetchDelay={100}
                >
                  <ContentCard
                    item={item}
                    isMobile={false}
                    rating={getContentRating(item)}
                  />
                </EnhancedLink>
              </CarouselItem>
            ))}

            {hasMoreItems && (loading || isLoadingMore) && (
              <CarouselItem className="pl-3 md:pl-4 basis-[48%] sm:basis-[35%] md:basis-[28%] lg:basis-[22%] xl:basis-[18%] flex items-center justify-center">
                <LoadingSpinner />
              </CarouselItem>
            )}
          </CarouselContent>

          <CarouselPrevious className="absolute -left-3 md:-left-4 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm hover:bg-background/90 border-0" />
          <CarouselNext className="absolute -right-3 md:-right-4 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm hover:bg-background/90 border-0" />
        </Carousel>
      </div>

      {hasMoreItems && !isMobile && (
        <div className="flex justify-center mt-4">
          {loading || isLoadingMore ? (
            <LoadingSpinner />
          ) : (
            <Button
              onClick={loadMoreItems}
              variant="outline"
              className="hover:bg-accent"
            >
              Load More
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
