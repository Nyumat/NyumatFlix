import { useLayoutEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { pages } from "@/config";
import { parseMovieView, parseTvView } from "@/lib/catalog-query";
import { countCatalogFilterBadge } from "@/lib/discover-filter-count";
import { filterDiscoverParams, searchParamsToRecord } from "@/lib/utils";

export const useFilters = (
  type: "movie" | "tv",
  serverDiscoverFilters?: Record<string, string>,
) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();

  const [urlRecord, setUrlRecord] = useState<Record<string, string>>(() =>
    serverDiscoverFilters ? { ...serverDiscoverFilters } : {},
  );

  useLayoutEffect(() => {
    setUrlRecord(
      searchParamsToRecord(new URLSearchParams(window.location.search)),
    );
  }, [searchKey]);

  const activeFilters = useMemo(
    () => filterDiscoverParams(urlRecord),
    [urlRecord],
  );

  const getFilter = (key: string) => activeFilters[key] ?? "";

  const catalogBase =
    type === "movie" ? pages.movie.catalog.link : pages.tv.catalog.link;

  const pushDiscoverFiltersToUrl = (mergedDiscover: Record<string, string>) => {
    const raw =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search)
        : new URLSearchParams(searchKey);
    const record = searchParamsToRecord(raw);
    const sortBy = record.sort_by;
    const currentView = record.view?.trim();
    const catalogFrom =
      record.catalog_from?.trim() ||
      (currentView && currentView !== "discover" && currentView !== "upcoming"
        ? currentView
        : undefined);

    const next = new URLSearchParams();
    next.set("view", "discover");
    next.set("mode", "results");
    if (catalogFrom) {
      next.set("catalog_from", catalogFrom);
    }
    for (const [key, val] of Object.entries(mergedDiscover)) {
      if (val) next.set(key, val);
    }
    if (sortBy) {
      next.set("sort_by", sortBy);
    }

    router.replace(`${catalogBase}?${next.toString()}`);
  };

  const setFilter = (partial: Record<string, string>) => {
    const raw =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search)
        : new URLSearchParams(searchKey);
    const current = filterDiscoverParams(searchParamsToRecord(raw));
    const merged = { ...current, ...partial };
    pushDiscoverFiltersToUrl(merged);
  };

  const saveFilters = () => {
    pushDiscoverFiltersToUrl(activeFilters);
  };

  const clearFilters = () => {
    const catalogFromRaw = urlRecord.catalog_from?.trim();
    if (catalogFromRaw) {
      const listView =
        type === "movie"
          ? parseMovieView(catalogFromRaw)
          : parseTvView(catalogFromRaw);
      if (listView !== "discover") {
        const cleared = new URLSearchParams();
        cleared.set("view", listView);
        cleared.set("mode", "results");
        if (listView === "trending") {
          const tt = urlRecord.trending_time;
          if (tt === "week") cleared.set("trending_time", "week");
        }
        router.replace(`${catalogBase}?${cleared.toString()}`);
        return;
      }
    }

    const cleared = new URLSearchParams();
    cleared.set("view", "discover");
    const sortBy = urlRecord.sort_by;
    const hasUrlFilters = countCatalogFilterBadge(urlRecord, activeFilters) > 0;

    if (sortBy) {
      cleared.set("sort_by", sortBy);
    }

    if (urlRecord.mode === "results" || hasUrlFilters || Boolean(sortBy)) {
      cleared.set("mode", "results");
    }

    router.replace(`${catalogBase}?${cleared.toString()}`);
  };

  const count = useMemo(
    () => countCatalogFilterBadge(urlRecord, activeFilters),
    [urlRecord, activeFilters],
  );

  return {
    filters: activeFilters,
    count,
    getFilter,
    setFilter,
    saveFilters,
    clearFilters,
  };
};
