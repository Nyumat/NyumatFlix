import { IndexFeatureHero } from "@/components/catalog/index-feature-hero";
import { getTvHubFeature } from "@/lib/server/catalog-hub-feature";

export async function TvHubFeatureHero() {
  const hubFeature = await getTvHubFeature();
  if (!hubFeature?.item) {
    return null;
  }

  return (
    <IndexFeatureHero
      item={hubFeature.item}
      items={hubFeature.items}
      mediaType="tv"
      priority
    />
  );
}
