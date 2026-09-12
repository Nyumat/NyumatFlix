import {
  CatalogHeroPairFallback,
  CatalogRowFallback,
  TrendingSpotlightFallback,
} from "@/components/catalog/catalog-suspense-fallbacks";
import { IndexHeader } from "@/components/catalog/index-header";
import { IndexPage } from "@/components/catalog/index-page";
import {
  TrendingMoviesSection,
  TrendingPeopleSection,
  TrendingTvSection,
} from "@/components/trending/trending-hub-sections";
import { buildCatalogMetadata } from "@/lib/seo/metadata";
import { pages } from "@/config/pages";
import type { Metadata } from "next";
import { Suspense } from "react";

export const revalidate = 3600;

export const metadata: Metadata = buildCatalogMetadata({
  title: pages.trending.root.title,
  description:
    "Explore trending movies, TV shows, and people updated throughout the day on NyumatFlix.",
  path: pages.trending.root.link,
});

export default function TrendingHub() {
  return (
    <IndexPage
      header={
        <IndexHeader
          title="Trending"
          description="What everyone is watching and talking about right now."
        />
      }
    >
      <Suspense
        fallback={
          <>
            <TrendingSpotlightFallback />
            <CatalogRowFallback bleed />
            <CatalogHeroPairFallback />
          </>
        }
      >
        <TrendingMoviesSection />
      </Suspense>

      <Suspense
        fallback={
          <>
            <TrendingSpotlightFallback />
            <CatalogRowFallback bleed />
            <CatalogHeroPairFallback />
          </>
        }
      >
        <TrendingTvSection />
      </Suspense>

      <Suspense fallback={<CatalogRowFallback bleed />}>
        <TrendingPeopleSection />
      </Suspense>
    </IndexPage>
  );
}
