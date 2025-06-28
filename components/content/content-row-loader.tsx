"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { ContentRow, ContentRowVariant } from "./content-row";
import { useContentRow } from "@/hooks/useContentRow";

export interface ContentRowLoaderProps {
  rowId: string;
  title: string;
  href: string;
  minCount?: number;
  variant?: ContentRowVariant;
  enrich?: boolean;
  globalCache?: boolean;
}

/**
 * Client-side component that loads a content row with a guaranteed minimum number of items
 */
export function ContentRowLoader({
  rowId,
  title,
  href,
  minCount = 20,
  variant,
  enrich = false,
  globalCache = true,
}: ContentRowLoaderProps) {
  const { items, isLoading, error } = useContentRow({
    rowId,
    count: minCount,
    enrich,
    globalCache,
  });

  // Show skeleton while loading
  if (isLoading) {
    return (
      <div className="space-y-4 py-4 px-4 md:px-6 lg:px-8">
        <Skeleton className="h-8 w-64 mb-2 bg-background/20" />
        <div className="flex space-x-4 overflow-x-auto pb-2 -mx-1 scrollbar-hide">
          {Array.from({ length: minCount }).map((_, i) => (
            <div key={i} className="px-1">
              <Skeleton className="aspect-[2/3] min-w-[150px] w-[calc(20vw-16px)] max-w-[200px] h-auto rounded-md bg-background/20 backdrop-blur-sm" />
              <Skeleton className="h-4 w-3/4 mt-2 bg-background/20" />
              <Skeleton className="h-4 w-1/2 mt-1 bg-background/20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Show error or return ContentRow with items
  if (error || items.length === 0) {
    console.error(`Error loading content row ${rowId}:`, error);
    return null; // Hide row completely on error
  }

  return (
    <section id={rowId} className="my-4">
      <ContentRow title={title} items={items} href={href} variant={variant} />
    </section>
  );
}
