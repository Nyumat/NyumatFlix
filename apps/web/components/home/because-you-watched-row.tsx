"use client";

import { CatalogRowFallback } from "@/components/catalog/catalog-suspense-fallbacks";
import { TrendCarousel } from "@/components/trend/trend-client";
import { useBecauseYouWatched } from "@/hooks/use-because-you-watched";

export function BecauseYouWatchedRow() {
  const { row, isLoading } = useBecauseYouWatched();

  if (isLoading) {
    return <CatalogRowFallback />;
  }

  if (!row || row.items.length === 0) {
    return null;
  }

  return (
    <TrendCarousel
      title="Because you watched"
      description={row.seedTitle}
      items={row.items}
      type={row.mediaType}
    />
  );
}

export function HomeBecauseYouWatched() {
  return <BecauseYouWatchedRow />;
}
