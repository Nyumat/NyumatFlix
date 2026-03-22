import { Suspense } from "react";
import { cookies } from "next/headers";

import { TrendCarousel } from "@/components/trend/trend-client";
import { fetchCatalogShowcaseRows } from "@/lib/catalog-showcase-fetch";
import type { MovieWithMediaType, TvShowWithMediaType } from "@/tmdb/models";
import type { MediaItem } from "@/utils/typings";

const toMovieWithType = (items: MediaItem[]): MovieWithMediaType[] =>
  items.map((item) => ({
    ...item,
    media_type: "movie" as const,
  })) as MovieWithMediaType[];

const toTvWithType = (items: MediaItem[]): TvShowWithMediaType[] =>
  items.map((item) => ({
    ...item,
    media_type: "tv" as const,
  })) as TvShowWithMediaType[];

const CatalogCategoryShowcaseSkeleton = () => (
  <div className="space-y-10" aria-hidden>
    {[0, 1, 2].map((key) => (
      <div key={key} className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="aspect-poster w-28 shrink-0 animate-pulse rounded-lg bg-muted sm:w-32"
            />
          ))}
        </div>
      </div>
    ))}
  </div>
);

async function CatalogCategoryShowcaseInner({
  pageKey,
  excludeIds = [],
}: {
  pageKey: "movies" | "tv";
  excludeIds?: number[];
}) {
  const mediaType = pageKey === "movies" ? "movie" : "tv";
  const cookieStore = await cookies();
  const region = cookieStore.get("region")?.value ?? "US";

  const rowsData = await fetchCatalogShowcaseRows(
    pageKey,
    region,
    excludeIds ?? [],
  );

  if (rowsData.length === 0) return null;

  return (
    <>
      {rowsData.map((row) => {
        if (row.items.length === 0) return null;
        const items =
          mediaType === "movie"
            ? toMovieWithType(row.items)
            : toTvWithType(row.items);
        return (
          <TrendCarousel
            key={row.rowId}
            type={mediaType}
            title={row.title}
            description={undefined}
            link={row.href}
            items={items}
            compact
          />
        );
      })}
    </>
  );
}

export const CatalogCategoryShowcase = ({
  pageKey,
  excludeIds,
}: {
  pageKey: "movies" | "tv";
  excludeIds?: number[];
}) => (
  <Suspense fallback={<CatalogCategoryShowcaseSkeleton />}>
    <CatalogCategoryShowcaseInner excludeIds={excludeIds} pageKey={pageKey} />
  </Suspense>
);
