"use client";

import { ContentGrid } from "@/components/content/media-content-grid";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import type { MediaItem } from "@/utils/typings";
import { useCallback, useEffect, useRef, useState } from "react";

const SORT = "vote_average.desc";

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
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const fetchNextPage = useCallback(async () => {
    if (isLoading || currentPage >= totalPages) return;

    try {
      setIsLoading(true);
      const nextPage = currentPage + 1;
      const url = new URL(
        `/api/country/${countryCode}`,
        window.location.origin,
      );
      url.searchParams.set("type", mediaType);
      url.searchParams.set("page", nextPage.toString());
      url.searchParams.set("sortBy", SORT);

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }

      const data = await response.json();
      const raw: MediaItem[] = data.results || [];

      setItems((prev) => {
        const newItems = raw.filter(
          (newItem) => !prev.some((existing) => existing.id === newItem.id),
        );
        return [...prev, ...newItems];
      });
      setCurrentPage(nextPage);
    } catch (error) {
      console.error("Error loading more content:", error);
    } finally {
      setIsLoading(false);
    }
  }, [countryCode, mediaType, currentPage, totalPages, isLoading]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void fetchNextPage();
        }
      },
      { rootMargin: "200px" },
    );

    const node = sentinelRef.current;
    if (node) {
      observer.observe(node);
    }

    return () => {
      if (node) {
        observer.unobserve(node);
      }
    };
  }, [fetchNextPage]);

  return (
    <div className="space-y-6">
      <ContentGrid items={items} type={mediaType} />
      {currentPage < totalPages ? (
        <div ref={sentinelRef} className="h-1 w-full" aria-hidden />
      ) : null}

      {isLoading ? (
        <div className="flex justify-center py-6">
          <LoadingSpinner text="Loading more content..." />
        </div>
      ) : null}

      {currentPage >= totalPages && items.length > 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Showing {items.length} {mediaType === "movie" ? "movies" : "TV shows"}{" "}
          from {countryName}.
        </p>
      ) : null}
    </div>
  );
}
