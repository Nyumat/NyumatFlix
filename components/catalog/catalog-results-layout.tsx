import { CatalogDiscoverToolbarDynamic } from "@/components/catalog/catalog-discover-toolbar-dynamic";
import { CatalogInfiniteGrid } from "@/components/catalog/catalog-infinite-grid";
import { filterDiscoverParams } from "@/lib/utils";
import type { Genre, WatchProvider } from "@/tmdb/models";
import type { MediaItem } from "@/utils/typings";

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
}: CatalogResultsLayoutProps) => {
  const serverDiscoverFilters = filterDiscoverParams(queryParams);

  return items.length ? (
    <>
      <header className="space-y-1 text-center md:text-left">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
          {title}
        </h1>
        {description ? (
          <p className="text-muted-foreground">{description}</p>
        ) : null}
      </header>

      <CatalogDiscoverToolbarDynamic
        mediaType={mediaType}
        genres={genres}
        providers={providers}
        serverDiscoverFilters={serverDiscoverFilters}
      />

      <CatalogInfiniteGrid
        mediaType={mediaType}
        initialItems={items}
        initialPage={currentPage}
        totalPages={totalPages}
        queryParams={queryParams}
      />
    </>
  ) : (
    <>
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
          {title}
        </h1>
        {description ? (
          <p className="mx-auto mt-2 max-w-2xl text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>

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
