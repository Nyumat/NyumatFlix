import { CatalogCategoryShowcase } from "@/components/catalog/catalog-category-showcase";
import { loadCatalogShowcaseRows } from "@/lib/server/catalog-showcase-server";

type CatalogShowcaseCatalog = "movies" | "tv" | "anime";

export async function CatalogCategoryShowcaseServer({
  pageKey,
  excludeIds = [],
}: {
  pageKey: CatalogShowcaseCatalog;
  excludeIds?: number[];
}) {
  if (pageKey === "anime") {
    return (
      <CatalogCategoryShowcase pageKey={pageKey} excludeIds={excludeIds} />
    );
  }

  const [movieRows, tvRows] = await Promise.all([
    loadCatalogShowcaseRows("movies", excludeIds),
    loadCatalogShowcaseRows("tv", excludeIds),
  ]);

  return (
    <CatalogCategoryShowcase
      pageKey={pageKey}
      excludeIds={excludeIds}
      initialRowsByKind={{ movie: movieRows, tv: tvRows }}
    />
  );
}
