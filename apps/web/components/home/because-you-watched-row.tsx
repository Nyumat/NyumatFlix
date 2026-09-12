"use client";

import { CatalogRowFallback } from "@/components/catalog/catalog-suspense-fallbacks";
import { TrendCarousel } from "@/components/trend/trend-client";
import { usePersonalizedHome } from "@/hooks/use-personalized-home";
import type { BecauseYouWatchedSeed } from "@/lib/personalization/because-you-watched";
import { useEffect, useMemo, useState } from "react";

const seedValue = (seed: BecauseYouWatchedSeed) =>
  `${seed.mediaType}:${seed.contentId}`;

export function BecauseYouWatchedRow() {
  const { becauseYouWatched: row, isLoading } = usePersonalizedHome();
  const seeds = useMemo(() => {
    if (!row) {
      return [];
    }

    return row.seeds?.length ? row.seeds : [row];
  }, [row]);
  const firstSeedValue = seeds[0] ? seedValue(seeds[0]) : "";
  const [selectedSeedValue, setSelectedSeedValue] = useState("");

  useEffect(() => {
    if (!firstSeedValue) {
      return;
    }

    const stillAvailable = seeds.some(
      (seed) => seedValue(seed) === selectedSeedValue,
    );
    if (!stillAvailable) {
      setSelectedSeedValue(firstSeedValue);
    }
  }, [firstSeedValue, seeds, selectedSeedValue]);

  if (isLoading) {
    return <CatalogRowFallback bleed />;
  }

  const selectedSeed =
    seeds.find((seed) => seedValue(seed) === selectedSeedValue) ?? seeds[0];

  if (!selectedSeed || selectedSeed.items.length === 0) {
    return null;
  }

  return (
    <TrendCarousel
      key={seedValue(selectedSeed)}
      title="Because you watched"
      description={selectedSeed.seedTitle}
      items={selectedSeed.items}
      type={selectedSeed.mediaType}
      bleed
      recommendationSeedOptions={seeds.map((seed) => ({
        value: seedValue(seed),
        title: seed.seedTitle,
      }))}
      selectedRecommendationSeed={seedValue(selectedSeed)}
      onRecommendationSeedChange={setSelectedSeedValue}
    />
  );
}

export function HomeBecauseYouWatched() {
  return <BecauseYouWatchedRow />;
}
