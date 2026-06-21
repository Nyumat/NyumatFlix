import {
  CatalogHeroPairFallback,
  CatalogRowFallback,
  TrendingSpotlightFallback,
} from "@/components/catalog/catalog-suspense-fallbacks";
import { StaticHero } from "@/components/hero/hero-static";
import { ContentContainer } from "@/components/layout/content-container";
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
    <div className="flex w-full flex-col">
      <StaticHero imageUrl="/movie-banner.webp" title="" route="" hideTitle />

      <ContentContainer className="relative z-10 flex w-full flex-col items-center">
        <section className="min-h-screen w-full pb-16 pt-14 md:pt-16">
          <div className="container space-y-10">
            <header className="space-y-1 text-center md:text-left">
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
                Trending
              </h1>
            </header>

            <Suspense
              fallback={
                <>
                  <TrendingSpotlightFallback />
                  <CatalogRowFallback />
                  <CatalogHeroPairFallback />
                </>
              }
            >
              <TrendingMoviesSection />
            </Suspense>

            <Suspense
              fallback={
                <>
                  <CatalogRowFallback />
                  <CatalogHeroPairFallback />
                </>
              }
            >
              <TrendingTvSection />
            </Suspense>

            <Suspense fallback={<CatalogRowFallback />}>
              <TrendingPeopleSection />
            </Suspense>
          </div>
        </section>
      </ContentContainer>
    </div>
  );
}
