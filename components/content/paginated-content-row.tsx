"use client";

import { useState } from "react";
import { MediaItem } from "@/utils/typings";
import { ContentRow } from "@/components/content/content-row";

interface PaginatedContentRowProps {
  title: string;
  items: MediaItem[];
  href: string;
  category: string;
  mediaType: "movie" | "tv";
  variant?: "standard" | "ranked";
  filterUsOnly?: boolean;
}

/**
 * Client component wrapper for ContentRowActual that handles pagination logic
 */
export function PaginatedContentRow({
  title,
  items: initialItems,
  href,
  category,
  mediaType,
  variant,
  filterUsOnly = false,
}: PaginatedContentRowProps) {
  const [currentPage, setCurrentPage] = useState(1);

  const loadMoreContent = async () => {
    try {
      const nextPage = currentPage + 1;

      // Fetch the next page from the server
      const response = await fetch(
        `/api/content?category=${category}&type=${mediaType}&page=${nextPage}&filterUsOnly=${filterUsOnly}`,
      );

      if (!response.ok) {
        throw new Error(`Error fetching data: ${response.statusText}`);
      }

      const data = await response.json();
      const newItems = data.results || [];

      if (newItems.length > 0) {
        setCurrentPage(nextPage);
        // Results are already processed and filtered by the API
        return newItems;
      }

      return [];
    } catch (error) {
      console.error("Error loading more content:", error);
      return [];
    }
  };

  return (
    <ContentRow
      title={title}
      items={initialItems}
      href={href}
      variant={variant}
      onLoadMore={loadMoreContent}
      hasMoreItems={true}
    />
  );
}
