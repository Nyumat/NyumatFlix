"use client";

import { ContentGrid } from "@/components/content/content-grid";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { MediaItem } from "@/utils/typings";
import { useCallback, useEffect, useRef, useState } from "react";

interface BrowseCountryClientProps {
  countryCode: string;
  countryName: string;
  initialItems: MediaItem[];
  totalPages: number;
  mediaType: "movie" | "tv";
}

export default function BrowseCountryClient({
  countryCode,
  countryName,
  initialItems,
  totalPages,
  mediaType,
}: BrowseCountryClientProps) {
  const [items, setItems] = useState<MediaItem[]>(initialItems);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadMoreItems = useCallback(async () => {
    if (isLoading || currentPage >= totalPages) return;

    setIsLoading(true);
    setHasError(false);

    try {
      const nextPage = currentPage + 1;

      // Alternate between different sort methods for variety
      const sortMethods = [
        "vote_average.desc", // Highest rated
        "popularity.desc", // Most popular
        "vote_count.desc", // Most voted on
      ];
      const sortBy = sortMethods[nextPage % sortMethods.length];

      const response = await fetch(
        `/api/country/${countryCode}?type=${mediaType}&page=${nextPage}&sortBy=${sortBy}`,
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }

      const data = await response.json();

      if (data.results && data.results.length > 0) {
        // Filter out duplicates
        const newItems = data.results.filter(
          (newItem: MediaItem) =>
            !items.some((existingItem) => existingItem.id === newItem.id),
        );

        setItems((prevItems) => [...prevItems, ...newItems]);
        setCurrentPage(nextPage);
      }
    } catch (error) {
      console.error("Error loading more content:", error);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [countryCode, mediaType, currentPage, totalPages, isLoading, items]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && !isLoading && currentPage < totalPages) {
          loadMoreItems();
        }
      },
      {
        threshold: 0.1,
        rootMargin: "100px",
      },
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => {
      if (sentinelRef.current) {
        observer.unobserve(sentinelRef.current);
      }
    };
  }, [loadMoreItems, isLoading, currentPage, totalPages]);

  return (
    <div>
      <ContentGrid items={items} type={mediaType} />
      {currentPage < totalPages && (
        <div ref={sentinelRef} className="h-1 w-full" />
      )}

      {isLoading && (
        <div className="flex justify-center py-8">
          <LoadingSpinner text="Loading more content..." />
        </div>
      )}
      {hasError && (
        <div className="flex justify-center py-8">
          <div className="text-center">
            <p className="text-muted-foreground mb-2">
              Failed to load more content
            </p>
            <button
              onClick={loadMoreItems}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/80 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {currentPage >= totalPages && items.length > 0 && (
        <div className="flex justify-center py-8">
          <p className="text-muted-foreground">
            You've reached the end! Found {items.length}{" "}
            {mediaType === "movie" ? "movies" : "shows"} from {countryName}.
          </p>
        </div>
      )}
    </div>
  );
}
