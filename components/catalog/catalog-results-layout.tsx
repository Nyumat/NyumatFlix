import { CatalogDiscoverToolbarDynamic } from "@/components/catalog/catalog-discover-toolbar-dynamic";
import { CatalogInfiniteGrid } from "@/components/catalog/catalog-infinite-grid";
import { CatalogGridFallback } from "@/components/catalog/catalog-suspense-fallbacks";
import { QueryPageHeader } from "@/components/catalog/query-page-header";
import { filterDiscoverParams } from "@/lib/utils";
import type { Genre, WatchProvider } from "@/tmdb/models";
import type { MediaItem } from "@/utils/typings";
import { Suspense } from "react";

type CatalogResultsLayoutProps = {
  mediaType: "movie" | "tv";
  title: string;
  description?: string;
  genres: Genre[];
  providers: WatchProvider[];
  items: MediaItem[];
  currentPage: number;
  totalPages: number;
  queryParams: Record<string, string>;
  emptyTitle: string;
  emptyDescription?: string;
  indexHref?: string;
};

export const CatalogResultsLayout = ({
  mediaType,
  title,
  description,
  genres,
  providers,
  items,
  currentPage,
  totalPages,
  queryParams,
  emptyTitle,
  emptyDescription,
  indexHref,
}: CatalogResultsLayoutProps) => {
  const serverDiscoverFilters = filterDiscoverParams(queryParams);

  return items.length ? (
    <>
      <QueryPageHeader
        title={title}
        description={description}
        backHref={indexHref}
      />

      <CatalogDiscoverToolbarDynamic
        mediaType={mediaType}
        genres={genres}
        providers={providers}
        serverDiscoverFilters={serverDiscoverFilters}
      />

      <Suspense fallback={<CatalogGridFallback />}>
        <CatalogInfiniteGrid
          mediaType={mediaType}
          initialItems={items}
          initialPage={currentPage}
          totalPages={totalPages}
          queryParams={queryParams}
        />
      </Suspense>
    </>
  ) : (
    <>
      <QueryPageHeader
        title={title}
        description={description}
        backHref={indexHref}
        className="mx-auto max-w-2xl"
      />

      <CatalogDiscoverToolbarDynamic
        mediaType={mediaType}
        genres={genres}
        providers={providers}
        serverDiscoverFilters={serverDiscoverFilters}
      />

      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="font-medium">{emptyTitle}</p>
        {emptyDescription ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {emptyDescription}
          </p>
        ) : null}
      </div>
    </>
  );
};
