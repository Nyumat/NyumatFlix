import "server-only";

import type { HomeCollectionCard } from "@/lib/cards/catalog-dto";
import catalog from "@/data/collections/catalog.json";
import { cache } from "react";

export type HomeCollection = HomeCollectionCard;

export const getHomeCollections = cache(async (): Promise<HomeCollection[]> => {
  return catalog as HomeCollection[];
});
