import { CatalogRowFallback } from "@/components/catalog/catalog-suspense-fallbacks";
import {
  TrendingMoviesSectionFallback,
  TrendingTvSectionFallback,
} from "@/components/catalog/hub-loading-manifests";
import { IndexHeader } from "@/components/catalog/index-header";
import { IndexFeatureHeroFallback } from "@/components/catalog/index-feature-hero-fallback";
import { IndexPage } from "@/components/catalog/index-page";
import {
  TrendingMoviesSection,
  TrendingFeatureHero,
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
      <Suspense fallback={<IndexFeatureHeroFallback />}>
        <TrendingFeatureHero />
      </Suspense>
      <Suspense fallback={<TrendingMoviesSectionFallback />}>
        <TrendingMoviesSection />
      </Suspense>

      <Suspense fallback={<TrendingTvSectionFallback />}>
        <TrendingTvSection />
      </Suspense>

      <Suspense fallback={<CatalogRowFallback bleed />}>
        <TrendingPeopleSection />
      </Suspense>
    </IndexPage>
  );
}
