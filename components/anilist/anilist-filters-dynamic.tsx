"use client";

import dynamic from "next/dynamic";

const AniListFiltersInner = dynamic(
  () => import("./anilist-filters").then((mod) => mod.AniListFilters),
  {
    ssr: false,
    loading: () => (
      <div
        className="h-10 w-32 animate-pulse rounded-md bg-muted"
        aria-hidden="true"
      />
    ),
  },
);

type AniListFiltersDynamicProps = {
  serverParams: Record<string, string>;
};

export const AniListFiltersDynamic = ({
  serverParams,
}: AniListFiltersDynamicProps) => (
  <AniListFiltersInner serverParams={serverParams} />
);
