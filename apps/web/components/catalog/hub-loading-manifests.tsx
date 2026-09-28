import { IndexFeatureHeroFallback } from "@/components/catalog/index-feature-hero-fallback";
import {
  CatalogCollectionsFallback,
  CatalogRankedRowFallback,
  CatalogRowFallback,
  CatalogShowcaseRowFallback,
  HomeProviderRailFallback,
  RecentlyWatchedRowFallback,
} from "@/components/catalog/catalog-suspense-fallbacks";
import { Skeleton } from "@/components/ui/skeleton";
import type { ReactNode } from "react";

type ManifestSection = {
  id: string;
  node: ReactNode;
};

const manifestSections = (sections: ManifestSection[]) =>
  sections.map(({ id, node }) => (
    <div key={id} data-testid={id}>
      {node}
    </div>
  ));

export const HomeHubLoadingSections = () =>
  manifestSections([
    { id: "home-hub-section-hero", node: <IndexFeatureHeroFallback /> },
    { id: "home-hub-section-providers", node: <HomeProviderRailFallback /> },
    {
      id: "home-hub-section-provider-genre",
      node: <CatalogShowcaseRowFallback bleed />,
    },
    {
      id: "home-hub-section-community",
      node: <CatalogRowFallback bleed />,
    },
    {
      id: "home-hub-section-recent",
      node: <RecentlyWatchedRowFallback bleed />,
    },
    {
      id: "home-hub-section-up-next",
      node: <RecentlyWatchedRowFallback bleed />,
    },
    {
      id: "home-hub-section-because",
      node: <CatalogRowFallback bleed />,
    },
    {
      id: "home-hub-section-collections",
      node: <CatalogCollectionsFallback />,
    },
    {
      id: "home-hub-section-popular-movies",
      node: <CatalogRowFallback bleed />,
    },
    {
      id: "home-hub-section-popular-tv",
      node: <CatalogRowFallback bleed />,
    },
    {
      id: "home-hub-section-showcase",
      node: <CatalogShowcaseRowFallback bleed />,
    },
  ]);

export const MoviesDiscoverHubLoadingSections = () =>
  manifestSections([
    { id: "movies-hub-section-hero", node: <IndexFeatureHeroFallback /> },
    {
      id: "movies-hub-section-recent",
      node: <RecentlyWatchedRowFallback bleed />,
    },
    {
      id: "movies-hub-section-trending",
      node: <CatalogRowFallback bleed />,
    },
    {
      id: "movies-hub-section-top-rated",
      node: <CatalogRankedRowFallback bleed />,
    },
    {
      id: "movies-hub-section-popular",
      node: <CatalogRowFallback bleed />,
    },
    {
      id: "movies-hub-section-showcase",
      node: <CatalogShowcaseRowFallback bleed />,
    },
  ]);

export const TvDiscoverHubLoadingSections = () =>
  manifestSections([
    { id: "tv-hub-section-hero", node: <IndexFeatureHeroFallback /> },
    {
      id: "tv-hub-section-recent",
      node: <RecentlyWatchedRowFallback bleed />,
    },
    {
      id: "tv-hub-section-trending",
      node: <CatalogRowFallback bleed />,
    },
    {
      id: "tv-hub-section-top-rated",
      node: <CatalogRankedRowFallback bleed />,
    },
    {
      id: "tv-hub-section-popular",
      node: <CatalogRowFallback bleed />,
    },
    {
      id: "tv-hub-section-showcase",
      node: <CatalogShowcaseRowFallback bleed />,
    },
  ]);

export const AnimeHubChromeFallback = () => (
  <div className="flex flex-wrap items-center justify-end gap-2" aria-hidden>
    <Skeleton className="h-10 w-28 rounded-md" />
  </div>
);

export const AnimeHubLoadingSections = () =>
  manifestSections([
    { id: "anime-hub-section-hero", node: <IndexFeatureHeroFallback /> },
    { id: "anime-hub-section-chrome", node: <AnimeHubChromeFallback /> },
    {
      id: "anime-hub-section-recent",
      node: <RecentlyWatchedRowFallback bleed />,
    },
    {
      id: "anime-hub-section-ranked",
      node: <CatalogRankedRowFallback bleed />,
    },
    {
      id: "anime-hub-section-trending",
      node: <CatalogRowFallback bleed />,
    },
    {
      id: "anime-hub-section-popular",
      node: <CatalogRowFallback bleed />,
    },
    {
      id: "anime-hub-section-season",
      node: <CatalogRowFallback bleed />,
    },
    {
      id: "anime-hub-section-airing",
      node: <CatalogRowFallback bleed />,
    },
    {
      id: "anime-hub-section-movies",
      node: <CatalogRowFallback bleed />,
    },
    {
      id: "anime-hub-section-showcase",
      node: <CatalogShowcaseRowFallback bleed />,
    },
  ]);

export const TrendingMoviesSectionFallback = () => (
  <CatalogRankedRowFallback bleed />
);

export const TrendingTvSectionFallback = () => (
  <CatalogRankedRowFallback bleed />
);

export const TrendingHubLoadingSections = () =>
  manifestSections([
    {
      id: "trending-hub-section-hero",
      node: <IndexFeatureHeroFallback />,
    },
    {
      id: "trending-hub-section-recent",
      node: <RecentlyWatchedRowFallback bleed />,
    },
    {
      id: "trending-hub-section-movies",
      node: <TrendingMoviesSectionFallback />,
    },
    {
      id: "trending-hub-section-tv",
      node: <TrendingTvSectionFallback />,
    },
    {
      id: "trending-hub-section-people",
      node: <CatalogRowFallback bleed />,
    },
  ]);
