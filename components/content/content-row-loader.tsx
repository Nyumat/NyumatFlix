"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useContentRow } from "@/hooks/useContentRow";
import { ContentRow, ContentRowVariant } from "./content-row";

export interface ContentRowLoaderProps {
  rowId: string;
  title: string;
  href: string;
  minCount?: number;
  variant?: ContentRowVariant;
  enrich?: boolean;
  hide?: boolean;
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
  hide = false,
}: ContentRowLoaderProps) {
  const { items, isLoading, error } = useContentRow({
    rowId,
    count: minCount,
    enrich,
    hide,
  });

  if (hide) {
    return null;
  }

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
  if (error) {
    console.error(
      `[ContentRowLoader] Error loading content row ${rowId}:`,
      error,
    );
    return (
      <div className="space-y-4 py-4 px-4 md:px-6 lg:px-8">
        <div className="text-red-500 text-sm">
          Failed to load {title}: {error.message}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    console.warn(`[ContentRowLoader] No items found for row ${rowId}`);
    return (
      <div className="space-y-4 py-4 px-4 md:px-6 lg:px-8">
        <div className="text-muted-foreground text-sm">
          No content available for {title}
        </div>
      </div>
    );
  }

  return (
    <section id={rowId} className="my-4">
      <ContentRow title={title} items={items} href={href} variant={variant} />
    </section>
  );
}
