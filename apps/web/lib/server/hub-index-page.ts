import "server-only";

import type { PageBackdrop } from "@/components/hero/ambient-page-backdrop";
import {
  buildHeroBackdropFromItem,
  buildHeroBackdropsFromItems,
} from "@/lib/hero-hub-backdrops";
import type { CatalogHubFeature } from "@/lib/server/catalog-hub-feature";

export type HubIndexPageBackdrops = {
  backdrop: PageBackdrop | null;
  heroBackdrops: Array<PageBackdrop | null>;
};

export const resolveHubIndexPageBackdrops = (
  hubFeature: CatalogHubFeature | null,
  mediaType: "movie" | "tv",
): HubIndexPageBackdrops => {
  if (!hubFeature) {
    return { backdrop: null, heroBackdrops: [] };
  }

  const heroBackdrops = buildHeroBackdropsFromItems(
    hubFeature.items,
    mediaType,
    true,
  );
  const backdrop =
    hubFeature.backdrop ??
    buildHeroBackdropFromItem(hubFeature.item, mediaType, true);

  return { backdrop, heroBackdrops };
};
