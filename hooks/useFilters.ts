import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { pages } from "@/config";

import { filterDiscoverParams, searchParamsToRecord } from "@/lib/utils";

export const useFilters = (type: "movie" | "tv") => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();

  const activeParams = useMemo(
    () => searchParamsToRecord(new URLSearchParams(searchKey)),
    [searchKey],
  );

  const activeFilters = useMemo(
    () => filterDiscoverParams(activeParams),
    [activeParams],
  );

  const [overrides, setOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    setOverrides({});
  }, [searchKey]);

  const mergedFilters = useMemo(
    () => ({ ...activeFilters, ...overrides }),
    [activeFilters, overrides],
  );

  const getFilter = (key: string) => mergedFilters[key] ?? "";

  const setFilter = (value: Record<string, string>) => {
    setOverrides((prev) => ({
      ...prev,
      ...value,
    }));
  };

  const catalogBase =
    type === "movie" ? pages.movie.catalog.link : pages.tv.catalog.link;

  const saveFilters = () => {
    const next = new URLSearchParams();
    next.set("view", "discover");
    next.set("mode", "results");
    for (const [key, val] of Object.entries(mergedFilters)) {
      if (val) next.set(key, val);
    }
    const sortBy = activeParams.sort_by;

    if (sortBy) {
      next.set("sort_by", sortBy);
    }

    router.replace(`${catalogBase}?${next.toString()}`);
  };

  const clearFilters = () => {
    const cleared = new URLSearchParams();
    cleared.set("view", "discover");
    const sortBy = activeParams.sort_by;
    const hasUrlFilters = Object.values(activeFilters).some(Boolean);

    if (sortBy) {
      cleared.set("sort_by", sortBy);
    }

    if (activeParams.mode === "results" || hasUrlFilters || Boolean(sortBy)) {
      cleared.set("mode", "results");
    }

    setOverrides({});
    router.replace(`${catalogBase}?${cleared.toString()}`);
  };

  const count = useMemo(
    () => Object.values(mergedFilters).filter(Boolean).length,
    [mergedFilters],
  );

  return {
    filters: mergedFilters,
    count,
    getFilter,
    setFilter,
    saveFilters,
    clearFilters,
  };
};
