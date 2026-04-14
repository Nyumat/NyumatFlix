"use client";

import dynamic from "next/dynamic";
import type { Genre, WatchProvider } from "@/tmdb/models";

const DiscoverHubToolbarInner = dynamic(
  () =>
    import("./discover-hub-toolbar-inner").then(
      (mod) => mod.DiscoverHubToolbarInner,
    ),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex flex-wrap items-center justify-between gap-2"
        aria-hidden="true"
      >
        <div className="h-10 w-32 animate-pulse rounded-md bg-muted" />
        <div className="h-10 w-28 animate-pulse rounded-md bg-muted" />
      </div>
    ),
  },
);

type DiscoverHubToolbarDynamicProps = {
  type: "movie" | "tv";
  genres: Genre[];
  providers: WatchProvider[];
  serverDiscoverFilters: Record<string, string>;
};

export const DiscoverHubToolbarDynamic = (
  props: DiscoverHubToolbarDynamicProps,
) => <DiscoverHubToolbarInner {...props} />;
