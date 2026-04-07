import { useLayoutEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { pages } from "@/config";
import { parseMovieView, parseTvView } from "@/lib/catalog-query";
import {
  countCatalogFilterBadge,
  countDiscoverFilterSelections,
  isMeaningfulDiscoverValue,
} from "@/lib/discover-filter-count";
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

  const [draftFilters, setDraftFilters] = useState<Record<string, string>>(() =>
    filterDiscoverParams(serverDiscoverFilters ?? {}),
  );

  useLayoutEffect(() => {
    const record = searchParamsToRecord(
      new URLSearchParams(window.location.search),
    );
    setUrlRecord(record);
    setDraftFilters(filterDiscoverParams(record));
  }, [searchKey]);

  const activeFilters = useMemo(
    () => filterDiscoverParams(urlRecord),
    [urlRecord],
  );

  const getFilter = (key: string) => draftFilters[key] ?? "";

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
    setDraftFilters((prev) => {
      const merged = { ...prev, ...partial };
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(merged)) {
        if (isMeaningfulDiscoverValue(k, v)) {
          out[k] = v;
        }
      }
      return out;
    });
  };

  const resetDraftFromUrl = () => {
    const record = searchParamsToRecord(
      new URLSearchParams(window.location.search),
    );
    setDraftFilters(filterDiscoverParams(record));
  };

  const applyEmptyDiscoverFiltersToUrl = () => {
    const record = searchParamsToRecord(
      new URLSearchParams(window.location.search),
    );
    const catalogFromRaw = record.catalog_from?.trim();
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
          const tt = record.trending_time;
          if (tt === "week") cleared.set("trending_time", "week");
        }
        router.replace(`${catalogBase}?${cleared.toString()}`);
        return;
      }
    }

    const applied = filterDiscoverParams(record);
    const cleared = new URLSearchParams();
    cleared.set("view", "discover");
    const sortBy = record.sort_by;
    const hasUrlFilters = countCatalogFilterBadge(record, applied) > 0;

    if (sortBy) {
      cleared.set("sort_by", sortBy);
    }

    if (record.mode === "results" || hasUrlFilters || Boolean(sortBy)) {
      cleared.set("mode", "results");
    }

    router.replace(`${catalogBase}?${cleared.toString()}`);
  };

  const saveFilters = () => {
    if (countDiscoverFilterSelections(draftFilters) === 0) {
      applyEmptyDiscoverFiltersToUrl();
      return;
    }
    pushDiscoverFiltersToUrl(draftFilters);
  };

  const clearFilters = () => {
    setDraftFilters({});
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
    resetDraftFromUrl,
  };
};
