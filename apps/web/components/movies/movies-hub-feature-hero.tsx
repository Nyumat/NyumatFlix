import { IndexFeatureHero } from "@/components/catalog/index-feature-hero";
import { getMoviesCatalogHubFeature } from "@/lib/server/catalog-hub-feature";

export async function MoviesHubFeatureHero() {
  const hubFeature = await getMoviesCatalogHubFeature();
  if (!hubFeature?.item) {
    return null;
  }

  return (
    <IndexFeatureHero
      item={hubFeature.item}
      items={hubFeature.items}
      mediaType="movie"
      priority
    />
  );
}
