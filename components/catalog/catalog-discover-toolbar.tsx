"use client";

import { DiscoverFilters, DiscoverSort } from "@/components/discover/discover";
import type { Genre, WatchProvider } from "@/tmdb/models";

type CatalogDiscoverToolbarProps = {
  mediaType: "movie" | "tv";
  genres: Genre[];
  providers: WatchProvider[];
  serverDiscoverFilters: Record<string, string>;
};

export const CatalogDiscoverToolbar = ({
  mediaType,
  genres,
  providers,
  serverDiscoverFilters,
}: CatalogDiscoverToolbarProps) => (
  <div className="flex flex-wrap items-center justify-between gap-2">
    <DiscoverFilters
      type={mediaType}
      genres={genres}
      providers={providers}
      serverDiscoverFilters={serverDiscoverFilters}
    />
    <DiscoverSort type={mediaType} />
  </div>
);
