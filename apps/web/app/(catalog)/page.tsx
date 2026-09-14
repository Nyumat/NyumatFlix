import {
  CatalogCollectionsFallback,
  CatalogRowFallback,
  HomeProviderRailFallback,
  RecentlyWatchedRowFallback,
} from "@/components/catalog/catalog-suspense-fallbacks";
import { IndexFeatureHeroFallback } from "@/components/catalog/index-feature-hero-fallback";
import { HomeBecauseYouWatched } from "@/components/home/because-you-watched-row";
import { HomeHubFeatureHero } from "@/components/home/home-hub-feature-hero";
import { HomeProviderGenreShowcaseSection } from "@/components/home/home-provider-genre-showcase-section";
import { HomeProviderRail } from "@/components/home/home-provider-rail";
import {
  HomePopularMoviesCarousel,
  HomePopularTvCarousel,
} from "@/components/home/home-sections";
import { CatalogCategoryShowcase } from "@/components/catalog/catalog-category-showcase";
import { HomeRecentlyWatched } from "@/components/home/recently-watched-row";
import { HomeUpNextInbox } from "@/components/home/up-next-inbox-row";
import { IndexPage } from "@/components/catalog/index-page";
import { PageContainer } from "@/components/layout/page-container";
import { siteConfig } from "@/config/site";
import { SITE_URL } from "@/lib/constants";
import {
  DEFAULT_OG_IMAGE,
  DEFAULT_OG_IMAGE_TYPE,
  OG_IMAGE_SIZE,
} from "@/lib/seo/constants";
import { getHomeMovieHubFeature } from "@/lib/server/catalog-hub-feature";
import type { Metadata } from "next";
import { Suspense } from "react";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Home | NyumatFlix",
  description: siteConfig.description,
  openGraph: {
    type: "website",
    url: `${SITE_URL}/`,
    title: "Home | NyumatFlix",
    description: siteConfig.description,
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        width: OG_IMAGE_SIZE.width,
        height: OG_IMAGE_SIZE.height,
        type: DEFAULT_OG_IMAGE_TYPE,
        alt: "NyumatFlix",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: SITE_URL,
    title: "Home | NyumatFlix",
    description: siteConfig.description,
    images: [DEFAULT_OG_IMAGE],
  },
};

export default async function Home() {
  const hubFeature = await getHomeMovieHubFeature();

  return (
    <PageContainer className="bg-transparent">
      <IndexPage background="hub" backdrop={hubFeature?.backdrop ?? null}>
        <Suspense fallback={<IndexFeatureHeroFallback />}>
          <HomeHubFeatureHero />
        </Suspense>

        <Suspense fallback={<HomeProviderRailFallback />}>
          <HomeProviderRail />
        </Suspense>

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

        <CatalogCategoryShowcase pageKey="movies" />
      </IndexPage>
    </PageContainer>
  );
}
