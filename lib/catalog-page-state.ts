import type { MovieCatalogView, TvCatalogView } from "@/lib/catalog-query";
import { isDiscoverDefaultQuery } from "@/lib/discover-query-state";

type CatalogView = MovieCatalogView | TvCatalogView;

export type CatalogLayoutState = {
  isDiscoverView: boolean;
  isFirstPage: boolean;
  isDefaultDiscoverView: boolean;
  isHubLayout: boolean;
  isResultsLayout: boolean;
};

export const getCatalogLayoutState = (
  searchParams: Record<string, string>,
  view: CatalogView,
): CatalogLayoutState => {
  const isDiscoverView = view === "discover";
  const isFirstPage = (searchParams.page ?? "1") === "1";
  const isDefaultDiscoverView =
    isDiscoverView && isDiscoverDefaultQuery(searchParams);
  const isHubLayout =
    isDefaultDiscoverView && isFirstPage && searchParams.mode !== "results";

  return {
    isDiscoverView,
    isFirstPage,
    isDefaultDiscoverView,
    isHubLayout,
    isResultsLayout: !isHubLayout,
  };
};
