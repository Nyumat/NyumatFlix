import "server-only";

import { prepareCatalogRowItemsForRsc } from "@/lib/server/prepare-catalog-row-items";
import type { CatalogShowcaseRow } from "@/components/catalog/catalog-genre-rail";
import { fetchCatalogShowcaseRows } from "@/lib/catalog-showcase-fetch";
import { withCanonicalCatalogHrefs } from "@/lib/server/catalog-canonical-hrefs";
import { TMDB_WATCH_REGION } from "@/lib/constants";

export const loadCatalogShowcaseRows = async (
  pageKey: "movies" | "tv",
  excludeIds: number[] = [],
): Promise<CatalogShowcaseRow[]> => {
  const enriched = await withCanonicalCatalogHrefs(
    await fetchCatalogShowcaseRows(pageKey, TMDB_WATCH_REGION, excludeIds),
    pageKey === "movies" ? "movie" : "tv",
  );

  return Promise.all(
    enriched.map(async (row) => ({
      ...row,
      items: await prepareCatalogRowItemsForRsc(row.items),
    })),
  );
};
