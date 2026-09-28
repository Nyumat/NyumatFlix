"use client";

import { Skeleton } from "@/components/ui/skeleton";
import {
  catalogGridTileImageClassName,
  isBackdropCatalogCardStyle,
  useCatalogCardStyle,
  type CatalogCardStyle,
} from "@/lib/catalog-card-presentation";
import { cn } from "@/lib/utils";

type CatalogGridTileSkeletonProps = {
  style?: CatalogCardStyle;
};

/** Matches {@link ContentCard} / {@link BackdropCard} grid footprint. */
export function CatalogGridTileSkeleton({
  style: styleProp,
}: CatalogGridTileSkeletonProps = {}) {
  const storeStyle = useCatalogCardStyle();
  const style = styleProp ?? storeStyle;

  if (isBackdropCatalogCardStyle(style)) {
    return (
      <div className="flex w-full min-w-0 flex-col gap-2">
        <Skeleton className={catalogGridTileImageClassName(style)} />
        <div className="pointer-events-none min-w-0 space-y-1.5">
          <Skeleton className="h-4 w-4/5 rounded-md" />
          <Skeleton className="h-3 w-1/2 rounded-md" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 w-full">
      <Skeleton className={catalogGridTileImageClassName(style)} />
    </div>
  );
}

type CatalogGridSkeletonProps = {
  count?: number;
  className?: string;
  style?: CatalogCardStyle;
};

export function CatalogGridSkeleton({
  count = 12,
  className,
  style,
}: CatalogGridSkeletonProps = {}) {
  return (
    <div
      className={cn("grid-list", className)}
      aria-hidden
      data-catalog-grid-skeleton
    >
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="min-w-0">
          <CatalogGridTileSkeleton style={style} />
        </div>
      ))}
    </div>
  );
}

/** Carousel row tile — matches {@link StandardContentRow} cards. */
export function CatalogCarouselTileSkeleton({
  style: styleProp,
}: CatalogGridTileSkeletonProps = {}) {
  const storeStyle = useCatalogCardStyle();
  const style = styleProp ?? storeStyle;
  return <Skeleton className={catalogGridTileImageClassName(style)} />;
}
