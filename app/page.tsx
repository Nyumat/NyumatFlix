import { StaticHero } from "@/components/hero/hero-static";
import {
  CatalogCollectionsFallback,
  CatalogHeroPairFallback,
  CatalogRowFallback,
  CatalogSpotlightFallback,
} from "@/components/catalog/catalog-suspense-fallbacks";
import {
  HomeCollectionsSection,
  HomeFeaturedMovie,
  HomePopularMovieHeroes,
  HomePopularMoviesCarousel,
  HomePopularTvCarousel,
  HomePopularTvHeroes,
  HomeTrendingMovieHeroes,
  HomeTrendingMoviesCarousel,
  HomeTrendingTvCarousel,
  HomeTrendingTvHeroes,
} from "@/components/home/home-sections";
import { ContentContainer } from "@/components/layout/content-container";
import { PageContainer } from "@/components/layout/page-container";
import { siteConfig } from "@/config/site";
import { SITE_URL } from "@/lib/constants";
import {
  DEFAULT_OG_IMAGE,
  DEFAULT_OG_IMAGE_TYPE,
  OG_IMAGE_SIZE,
} from "@/lib/seo/constants";
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

export default function Home() {
  return (
    <PageContainer>
      <div className="flex w-full flex-col">
        <StaticHero imageUrl="/movie-banner.webp" title="" route="" hideTitle />

        <ContentContainer className="relative z-10 flex w-full flex-col items-center">
          <section className="min-h-screen w-full pb-16 pt-14 md:pt-16">
            <div className="container space-y-10">
              <Suspense fallback={<CatalogSpotlightFallback />}>
                <HomeFeaturedMovie />
              </Suspense>

              <Suspense fallback={<CatalogRowFallback />}>
                <HomeTrendingMoviesCarousel />
              </Suspense>

              <Suspense fallback={<CatalogHeroPairFallback />}>
                <HomeTrendingMovieHeroes />
              </Suspense>

              <Suspense fallback={<CatalogCollectionsFallback />}>
                <HomeCollectionsSection />
              </Suspense>

              <Suspense fallback={<CatalogRowFallback />}>
                <HomePopularMoviesCarousel />
              </Suspense>

              <Suspense fallback={<CatalogHeroPairFallback />}>
                <HomeTrendingTvHeroes />
              </Suspense>

              <Suspense fallback={<CatalogRowFallback />}>
                <HomeTrendingTvCarousel />
              </Suspense>

              <Suspense fallback={<CatalogHeroPairFallback />}>
                <HomePopularMovieHeroes />
              </Suspense>

              <Suspense fallback={<CatalogRowFallback />}>
                <HomePopularTvCarousel />
              </Suspense>

              <Suspense fallback={<CatalogHeroPairFallback />}>
                <HomePopularTvHeroes />
              </Suspense>
            </div>
          </section>
        </ContentContainer>
      </div>
    </PageContainer>
  );
}
