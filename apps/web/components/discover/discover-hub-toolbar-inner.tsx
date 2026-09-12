"use client";

import { DiscoverFilterSort } from "@/components/discover/discover";
import type { Genre, WatchProvider } from "@/tmdb/models";

export function DiscoverHubToolbarInner({
  type,
  genres,
  providers,
  serverDiscoverFilters,
}: {
  type: "movie" | "tv";
  genres: Genre[];
  providers: WatchProvider[];
  serverDiscoverFilters: Record<string, string>;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <DiscoverFilterSort
        type={type}
        genres={genres}
        providers={providers}
        serverDiscoverFilters={serverDiscoverFilters}
      />
    </div>
  );
}
