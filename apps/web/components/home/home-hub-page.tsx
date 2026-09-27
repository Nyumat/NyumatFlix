import {
  CatalogRankedRowFallback,
  CatalogRowFallback,
  RecentlyWatchedRowFallback,
} from "@/components/catalog/catalog-suspense-fallbacks";
import { IndexFeatureHeroFallback } from "@/components/catalog/index-feature-hero-fallback";
import { HomeBecauseYouWatched } from "@/components/home/because-you-watched-row";
import { HomeHubFeatureHero } from "@/components/home/home-hub-feature-hero";
import { HomeProviderGenreShowcaseSection } from "@/components/home/home-provider-genre-showcase-section";
import {
  HomePopularMoviesCarousel,
  HomePopularTvCarousel,
} from "@/components/home/home-sections";
import { CatalogCategoryShowcaseServer } from "@/components/catalog/catalog-category-showcase-server";
import { HomeRecentlyWatched } from "@/components/home/recently-watched-row";
import { HomeTop10Today } from "@/components/home/home-top10-today";
import { HomeUpNextInbox } from "@/components/home/up-next-inbox-row";
import { IndexPage } from "@/components/catalog/index-page";
import { getCachedSiteFlags } from "@/lib/flags/site-flags-server";
import { getHomeMovieHubFeature } from "@/lib/server/catalog-hub-feature";
import { resolveHubIndexPageBackdrops } from "@/lib/server/hub-index-page";
import { applyCatalogHourCacheLife } from "@/lib/server/route-cache-life";
import { Suspense } from "react";

export async function HomeHubPage() {
  "use cache";
  applyCatalogHourCacheLife();

  const [hubFeature, flags] = await Promise.all([
    getHomeMovieHubFeature(),
    getCachedSiteFlags(),
  ]);
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
        <HomeHubFeatureHero />
      </Suspense>

      {flags.homeTop10 ? (
        <Suspense fallback={<CatalogRankedRowFallback bleed />}>
          <HomeTop10Today />
        </Suspense>
      ) : null}

      <Suspense fallback={<CatalogRowFallback bleed />}>
        <HomeProviderGenreShowcaseSection />
      </Suspense>

      <Suspense fallback={<RecentlyWatchedRowFallback bleed />}>
        <HomeRecentlyWatched />
      </Suspense>

      <Suspense fallback={<RecentlyWatchedRowFallback bleed />}>
        <HomeUpNextInbox />
      </Suspense>

      <Suspense fallback={<CatalogRowFallback bleed />}>
        <HomeBecauseYouWatched />
      </Suspense>

      <Suspense fallback={<CatalogRowFallback bleed />}>
        <HomePopularMoviesCarousel />
      </Suspense>

      <Suspense fallback={<CatalogRowFallback bleed />}>
        <HomePopularTvCarousel />
      </Suspense>

      <Suspense fallback={<CatalogRowFallback bleed />}>
        <CatalogCategoryShowcaseServer pageKey="movies" />
      </Suspense>
    </IndexPage>
  );
}
