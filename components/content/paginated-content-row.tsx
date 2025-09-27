"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import useMedia from "@/hooks/useMedia";
import { MediaItem } from "@/utils/typings";
import { ContentCard } from "./content-card";
import { ContentRowHeader } from "./content-row-header";

// Props for the PaginatedContentRow
interface PaginatedContentRowProps {
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
    return item.content_rating || undefined;
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

  const LoadingComponent = () => (
    <div className="flex items-center justify-center min-h-[150px] w-full">
      <LoadingSpinner size="lg" />
    </div>
  );

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
          className="w-full"
        >
          <CarouselContent className="-ml-3 md:-ml-4">
            {items.map((item, index) => (
              <CarouselItem
                key={`${item.id}-${index}`}
                className="pl-3 md:pl-4 basis-[40%] sm:basis-[28%] md:basis-[22%] lg:basis-[18%] xl:basis-[12%]"
              >
                <ContentCard
                  item={item}
                  isMobile={false}
                  rating={getContentRating(item)}
                />
              </CarouselItem>
            ))}

            {hasMoreItems && (loading || isLoadingMore) && (
              <CarouselItem className="pl-3 md:pl-4 basis-[48%] sm:basis-[35%] md:basis-[28%] lg:basis-[22%] xl:basis-[18%] flex items-center justify-center">
                <LoadingComponent />
              </CarouselItem>
            )}
          </CarouselContent>

          <CarouselPrevious className="absolute -left-3 md:-left-4 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm hover:bg-background/90 border-0" />
          <CarouselNext className="absolute -right-3 md:-right-4 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm hover:bg-background/90 border-0" />
        </Carousel>
      </div>

      {/* Pagination controls for manual page navigation */}
      <div className="flex justify-center items-center gap-4 mt-4">
        <Button
          variant="outline"
          onClick={handlePrevPage}
          disabled={currentPage <= 1}
          size="sm"
        >
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">
          Page {currentPage} of {totalPages}
        </span>
        <Button
          variant="outline"
          onClick={handleNextPage}
          disabled={currentPage >= totalPages}
          size="sm"
        >
          Next
        </Button>
      </div>

      {/* Load more for infinite scroll if needed */}
      {hasMoreItems && !isMobile && (
        <div className="flex justify-center mt-4">
          {loading || isLoadingMore ? (
            <LoadingComponent />
          ) : (
            <Button onClick={loadMoreItems} variant="outline">
              Load More Items
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
