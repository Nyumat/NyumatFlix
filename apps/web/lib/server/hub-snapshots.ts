import "server-only";

import type { CatalogMediaCard } from "@/lib/cards/catalog-dto";
import type { HomeHubSnapshot } from "@/lib/server/hub-snapshot-types";
import homeSnapshot from "@/data/hubs/home.json";

const snapshot = homeSnapshot as HomeHubSnapshot;

const hasRows = (value: CatalogMediaCard[] | undefined): boolean =>
  Array.isArray(value) && value.length > 0;

export const getHomeHubSnapshot = (): HomeHubSnapshot | null => {
  if (!snapshot.generatedAt) {
    return null;
  }
  return snapshot;
};

export const getSnapshotTop10 = (): CatalogMediaCard[] | null => {
  const data = getHomeHubSnapshot();
  return data && hasRows(data.top10) ? data.top10 : null;
};

export const getSnapshotTrendingMovies = (): CatalogMediaCard[] | null => {
  const data = getHomeHubSnapshot();
  return data && hasRows(data.trendingMovies) ? data.trendingMovies : null;
};

export const getSnapshotPopularMovies = (): CatalogMediaCard[] | null => {
  const data = getHomeHubSnapshot();
  return data && hasRows(data.popularMovies) ? data.popularMovies : null;
};

export const getSnapshotTrendingTv = (): CatalogMediaCard[] | null => {
  const data = getHomeHubSnapshot();
  return data && hasRows(data.trendingTv) ? data.trendingTv : null;
};

export const getSnapshotPopularTv = (): CatalogMediaCard[] | null => {
  const data = getHomeHubSnapshot();
  return data && hasRows(data.popularTv) ? data.popularTv : null;
};

export const getSnapshotHomeHero = (): HomeHubSnapshot["homeHero"] | null => {
  const data = getHomeHubSnapshot();
  if (!data?.homeHero?.items?.length) {
    return null;
  }
  return data.homeHero;
};

export const getSnapshotStaticMovieIds = (): number[] => {
  const data = getHomeHubSnapshot();
  return data?.staticMovieIds ?? [];
};

export const getSnapshotStaticTvIds = (): number[] => {
  const data = getHomeHubSnapshot();
  return data?.staticTvIds ?? [];
};
