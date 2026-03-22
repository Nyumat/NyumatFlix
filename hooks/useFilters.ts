import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { pages } from "@/config";

import { filterDiscoverParams } from "@/lib/utils";

export const useFilters = (type: "movie" | "tv") => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeParams = Object.fromEntries(searchParams);

  const [filters, setFilters] = useState<Record<string, string>>(() =>
    filterDiscoverParams(activeParams),
  );

  const getFilter = (key: string) => {
    return filters[key] ?? "";
  };

  const setFilter = (value: Record<string, string>) => {
    setFilters({
      ...filters,
      ...value,
    });
  };

  const catalogBase =
    type === "movie" ? pages.movie.catalog.link : pages.tv.catalog.link;

  const saveFilters = () => {
    const next = new URLSearchParams();
    next.set("view", "discover");
    for (const [key, val] of Object.entries(filters)) {
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

    if (sortBy) {
      cleared.set("sort_by", sortBy);
    }

    setFilters({});
    router.replace(`${catalogBase}?${cleared.toString()}`);
  };

  const count = Object.values(filters).filter(Boolean).length;

  return {
    filters,
    count,
    getFilter,
    setFilter,
    saveFilters,
    clearFilters,
  };
};
