import {
  AnimeHubLoadingSections,
  HomeHubLoadingSections,
  MoviesDiscoverHubLoadingSections,
  TrendingHubHeaderFallback,
  TrendingMoviesSectionFallback,
  TrendingTvSectionFallback,
  TvDiscoverHubLoadingSections,
} from "@/components/catalog/hub-loading-manifests";
import { IndexPageSkeleton } from "@/components/catalog/index-page-skeleton";
import { CatalogRowFallback } from "@/components/catalog/catalog-suspense-fallbacks";

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
    <IndexPageSkeleton
      withPageContainer={withPageContainer}
      header={<TrendingHubHeaderFallback />}
    >
      <TrendingMoviesSectionFallback />
      <TrendingTvSectionFallback />
      <CatalogRowFallback bleed />
    </IndexPageSkeleton>
  );
}
