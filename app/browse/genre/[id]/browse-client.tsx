"use client";

import { ContentGrid } from "@/components/content/content-grid";
import type { MediaItem } from "@/utils/typings";
import { useCallback, useEffect, useRef, useState } from "react";

interface BrowseClientProps {
  genreId: string;
  genreName: string;
  initialItems: MediaItem[];
  totalPages: number;
  mediaType: "movie" | "tv";
}

export default function BrowseGenreClient({
  genreId,
  genreName,
  initialItems,
  totalPages,
  mediaType,
}: BrowseClientProps) {
  const [items, setItems] = useState<MediaItem[]>(initialItems);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const fetchNextPage = useCallback(async () => {
    if (isLoading || currentPage >= totalPages) return;

    try {
      setIsLoading(true);
      const nextPage = currentPage + 1;
      const url = new URL(`/api/genre/${genreId}`, window.location.origin);
      url.searchParams.set("type", mediaType);
      url.searchParams.set("page", nextPage.toString());

      const res = await fetch(url.toString());
      if (!res.ok) {
        throw new Error("Network error while fetching additional titles");
      }
      const data = await res.json();
      const newItems: MediaItem[] = data.results || [];
      setItems((prev) => [...prev, ...newItems]);
      setCurrentPage(nextPage);
    } catch (err) {
      console.error("Failed to load more items", err);
    } finally {
      setIsLoading(false);
    }
  }, [genreId, mediaType, currentPage, totalPages, isLoading]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchNextPage();
        }
      },
      { rootMargin: "200px" },
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => {
      if (sentinelRef.current) {
        observer.unobserve(sentinelRef.current);
      }
    };
  }, [fetchNextPage]);

  return (
    <div>
      <ContentGrid items={items} type={mediaType} title={genreName} />
      {currentPage < totalPages && (
        <div ref={sentinelRef} className="h-1 w-full" />
      )}
      {isLoading && (
        <div className="flex justify-center py-6 text-muted-foreground">
          Loading more {mediaType === "movie" ? "movies" : "shows"}...
        </div>
      )}
    </div>
  );
}
