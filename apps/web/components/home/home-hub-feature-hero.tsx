import { IndexFeatureHero } from "@/components/catalog/index-feature-hero";
import { getHomeMovieHubFeature } from "@/lib/server/catalog-hub-feature";

export async function HomeHubFeatureHero() {
  const hubFeature = await getHomeMovieHubFeature();
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
