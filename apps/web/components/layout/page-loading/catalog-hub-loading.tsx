import {
  CatalogRankedRowFallback,
  CatalogRowFallback,
} from "@/components/catalog/catalog-suspense-fallbacks";
import { IndexFeatureHeroFallback } from "@/components/catalog/index-feature-hero-fallback";
import {
  AnimeHubLoadingSections,
  HomeHubLoadingSections,
  MoviesDiscoverHubLoadingSections,
  TrendingHubLoadingSections,
  TvDiscoverHubLoadingSections,
} from "@/components/catalog/hub-loading-manifests";
import { IndexPageSkeleton } from "@/components/catalog/index-page-skeleton";

type CatalogHubLoadingProps = {
  withPageContainer?: boolean;
};

export function CatalogHubLoading({
  withPageContainer = true,
}: CatalogHubLoadingProps = {}) {
  return (
    <IndexPageSkeleton background="hub" withPageContainer={withPageContainer}>
      <HomeHubLoadingSections />
    </IndexPageSkeleton>
  );
}

/** Lightweight shell for catalog routes that do not define their own loading UI. */
export function CatalogNavigationLoading() {
  return (
    <IndexPageSkeleton background="hub" withPageContainer={false}>
      <IndexFeatureHeroFallback />
      <CatalogRankedRowFallback bleed />
      <CatalogRowFallback bleed />
      <CatalogRowFallback bleed />
    </IndexPageSkeleton>
  );
}

export function CatalogDiscoverHubLoading({
  withPageContainer = false,
  mediaType = "movie",
}: CatalogHubLoadingProps & { mediaType?: "movie" | "tv" } = {}) {
  return (
    <IndexPageSkeleton background="hub" withPageContainer={withPageContainer}>
      {mediaType === "tv" ? (
        <TvDiscoverHubLoadingSections />
      ) : (
        <MoviesDiscoverHubLoadingSections />
      )}
    </IndexPageSkeleton>
  );
}

export function AnimeIndexHubLoading({
  withPageContainer = false,
}: CatalogHubLoadingProps = {}) {
  return (
    <IndexPageSkeleton background="hub" withPageContainer={withPageContainer}>
      <AnimeHubLoadingSections />
    </IndexPageSkeleton>
  );
}

export function TrendingIndexHubLoading({
  withPageContainer = false,
}: CatalogHubLoadingProps = {}) {
  return (
    <IndexPageSkeleton background="hub" withPageContainer={withPageContainer}>
      <TrendingHubLoadingSections />
    </IndexPageSkeleton>
  );
}
