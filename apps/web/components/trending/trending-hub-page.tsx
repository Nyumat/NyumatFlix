import {
  CatalogRowFallback,
  RecentlyWatchedRowFallback,
} from "@/components/catalog/catalog-suspense-fallbacks";
import {
  TrendingMoviesSectionFallback,
  TrendingTvSectionFallback,
} from "@/components/catalog/hub-loading-manifests";
import { IndexFeatureHeroFallback } from "@/components/catalog/index-feature-hero-fallback";
import { IndexPage } from "@/components/catalog/index-page";
import { RecentlyWatchedRow } from "@/components/home/recently-watched-row";
import {
  getTrendingHubFeature,
  TrendingMoviesSection,
  TrendingFeatureHero,
  TrendingPeopleSection,
  TrendingTvSection,
} from "@/components/trending/trending-hub-sections";
import { resolveHubIndexPageBackdrops } from "@/lib/server/hub-index-page";
import { applyCatalogHourCacheLife } from "@/lib/server/route-cache-life";
import { Suspense } from "react";

export async function TrendingHubPage() {
  "use cache";
  applyCatalogHourCacheLife();

  const hubFeature = await getTrendingHubFeature();
  const { backdrop, heroBackdrops } = resolveHubIndexPageBackdrops(
    hubFeature,
    "movie",
  );

  return (
    <IndexPage
      background="hub"
      backdrop={backdrop}
      heroBackdrops={heroBackdrops}
    >
      <Suspense fallback={<IndexFeatureHeroFallback />}>
        <TrendingFeatureHero />
      </Suspense>

      <Suspense fallback={<RecentlyWatchedRowFallback bleed />}>
        <RecentlyWatchedRow bleed />
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
