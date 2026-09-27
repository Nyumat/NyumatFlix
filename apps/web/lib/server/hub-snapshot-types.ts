import type { IndexFeatureHeroItem } from "@/components/catalog/index-feature-hero";
import type { PageBackdrop } from "@/components/hero/ambient-page-backdrop";
import type { CatalogMediaCard } from "@/lib/cards/catalog-dto";

export type HubSnapshotHero = {
  items: IndexFeatureHeroItem[];
  backdrop: PageBackdrop | null;
};

export type HomeHubSnapshot = {
  generatedAt: string;
  top10: CatalogMediaCard[];
  trendingMovies: CatalogMediaCard[];
  popularMovies: CatalogMediaCard[];
  trendingTv: CatalogMediaCard[];
  popularTv: CatalogMediaCard[];
  homeHero: HubSnapshotHero | null;
  warmPaths: string[];
  staticMovieIds: number[];
  staticTvIds: number[];
};
