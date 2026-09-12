"use client";

import { CatalogRowFallback } from "@/components/catalog/catalog-suspense-fallbacks";
import { TrendCarousel } from "@/components/trend/trend-client";
import { usePersonalizedHome } from "@/hooks/use-personalized-home";

export function BecauseYouWatchedRow() {
  const { becauseYouWatched: row, isLoading } = usePersonalizedHome();

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
