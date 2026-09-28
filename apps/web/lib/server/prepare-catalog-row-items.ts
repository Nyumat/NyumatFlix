import "server-only";

import {
  slimMediaItemsForRsc,
  type SlimmableMediaItem,
} from "@/lib/cards/catalog-dto";
import { enrichLocalizedCatalogBackdrops } from "@/lib/server/enrich-catalog-backdrops";

export const prepareCatalogRowItemsForRsc = async <
  T extends SlimmableMediaItem,
>(
  items: T[],
): Promise<T[]> => {
  const enriched = await enrichLocalizedCatalogBackdrops(items);
  return slimMediaItemsForRsc(enriched);
};
