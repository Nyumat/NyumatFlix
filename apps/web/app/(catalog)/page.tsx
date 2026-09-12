import {
  CatalogCollectionsFallback,
  CatalogRowFallback,
  RecentlyWatchedRowFallback,
} from "@/components/catalog/catalog-suspense-fallbacks";
import { HomeBecauseYouWatched } from "@/components/home/because-you-watched-row";
import { HomeProviderRail } from "@/components/home/home-provider-rail";
import {
  HomeCollectionsSection,
  HomePopularMoviesCarousel,
  HomePopularTvCarousel,
  HomeTrendingMoviesCarousel,
  HomeTrendingTvCarousel,
} from "@/components/home/home-sections";
import { HomeRecentlyWatched } from "@/components/home/recently-watched-row";
import { HomeUpNextInbox } from "@/components/home/up-next-inbox-row";
import type { PageBackdrop } from "@/components/hero/ambient-page-backdrop";
import {
  IndexFeatureHero,
  type IndexFeatureHeroItem,
} from "@/components/catalog/index-feature-hero";
import { IndexPage } from "@/components/catalog/index-page";
import { PageContainer } from "@/components/layout/page-container";
import { siteConfig } from "@/config/site";
import { SITE_URL } from "@/lib/constants";
import { getHomeTrendingMovies } from "@/lib/server/home-hub-data";
import {
  DEFAULT_OG_IMAGE,
  DEFAULT_OG_IMAGE_TYPE,
  OG_IMAGE_SIZE,
} from "@/lib/seo/constants";
import { tmdb, type WithImages } from "@/tmdb/api";
import { tmdbImage } from "@/tmdb/utils";
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

type HomeHeroFeature = {
  item: IndexFeatureHeroItem;
  backdrop: PageBackdrop | null;
};

const toHomeBackdrop = (item: IndexFeatureHeroItem): PageBackdrop | null => {
  if (!item.backdrop_path) return null;

  return {
    imageUrl: tmdbImage.backdrop(item.backdrop_path, "w1280"),
    alt: item.title ?? "Featured movie",
    priority: true,
  };
};

const getHomeHeroFeature = async (): Promise<HomeHeroFeature | null> => {
  const movies = await getHomeTrendingMovies();
  const featured = movies.find((movie) => Boolean(movie.backdrop_path));

  if (!featured) return null;

  let item: IndexFeatureHeroItem = featured;

  try {
    item = await tmdb.movie.detail<WithImages>({
      id: featured.id,
      append: "images",
    });
  } catch {
    item = featured;
  }

  return {
    item,
    backdrop: toHomeBackdrop(item) ?? toHomeBackdrop(featured),
  };
};

export default async function Home() {
  const heroFeature = await getHomeHeroFeature();
  const backdrop = heroFeature?.backdrop ?? null;

  return (
    <PageContainer>
      <IndexPage backdrop={backdrop}>
        {heroFeature ? (
          <IndexFeatureHero
            item={heroFeature.item}
            mediaType="movie"
            priority
          />
        ) : null}

        <HomeProviderRail />

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
          <HomeTrendingMoviesCarousel />
        </Suspense>

        <Suspense fallback={<CatalogCollectionsFallback />}>
          <HomeCollectionsSection />
        </Suspense>

        <Suspense fallback={<CatalogRowFallback bleed />}>
          <HomePopularMoviesCarousel />
        </Suspense>

        <Suspense fallback={<CatalogRowFallback bleed />}>
          <HomeTrendingTvCarousel />
        </Suspense>

        <Suspense fallback={<CatalogRowFallback bleed />}>
          <HomePopularTvCarousel />
        </Suspense>
      </IndexPage>
    </PageContainer>
  );
}
