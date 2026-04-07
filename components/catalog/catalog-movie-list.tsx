import { CatalogInfiniteGrid } from "@/components/catalog/catalog-infinite-grid";
import type { MediaItem } from "@/utils/typings";

type CatalogMovieListProps = {
  initialItems: MediaItem[];
  initialPage: number;
  totalPages: number;
  queryParams: Record<string, string>;
};

export const CatalogMovieList = ({
  initialItems,
  initialPage,
  totalPages,
  queryParams,
}: CatalogMovieListProps) => (
  <CatalogInfiniteGrid
    mediaType="movie"
    initialItems={initialItems}
    initialPage={initialPage}
    totalPages={totalPages}
    queryParams={queryParams}
  />
);
