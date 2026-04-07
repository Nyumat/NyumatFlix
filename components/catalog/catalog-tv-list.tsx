import { CatalogInfiniteGrid } from "@/components/catalog/catalog-infinite-grid";
import type { MediaItem } from "@/utils/typings";

type CatalogTvListProps = {
  initialItems: MediaItem[];
  initialPage: number;
  totalPages: number;
  queryParams: Record<string, string>;
};

export const CatalogTvList = ({
  initialItems,
  initialPage,
  totalPages,
  queryParams,
}: CatalogTvListProps) => (
  <CatalogInfiniteGrid
    mediaType="tv"
    initialItems={initialItems}
    initialPage={initialPage}
    totalPages={totalPages}
    queryParams={queryParams}
  />
);
