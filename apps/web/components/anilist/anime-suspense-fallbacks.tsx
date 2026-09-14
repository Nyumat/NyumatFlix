import {
  CatalogRowFallback,
  RecentlyWatchedRowFallback,
} from "@/components/catalog/catalog-suspense-fallbacks";
import { IndexFeatureHeroFallback } from "@/components/catalog/index-feature-hero-fallback";

/** @deprecated Use {@link IndexFeatureHeroFallback} from index-feature-hero-fallback */
export const AnimeHeroFallback = IndexFeatureHeroFallback;

export { IndexFeatureHeroFallback };

export const AnimeHubSectionsFallback = () => (
  <>
    <IndexFeatureHeroFallback />
    <RecentlyWatchedRowFallback bleed />
    <CatalogRowFallback bleed />
    <CatalogRowFallback bleed />
    <CatalogRowFallback bleed />
    <CatalogRowFallback bleed />
  </>
);
