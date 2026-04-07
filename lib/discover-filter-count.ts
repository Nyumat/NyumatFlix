export const isMeaningfulDiscoverValue = (
  key: string,
  val: string,
): boolean => {
  if (!val.trim()) return false;
  if ((key === "vote_average.gte" || key === "vote_count.gte") && val === "0") {
    return false;
  }
  return true;
};

export const countDiscoverFilterSelections = (
  discoverFilters: Record<string, string>,
): number => {
  let total = 0;
  for (const [key, val] of Object.entries(discoverFilters)) {
    if (!isMeaningfulDiscoverValue(key, val)) continue;
    if (key === "with_genres") {
      total += val
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean).length;
      continue;
    }
    if (key === "with_watch_providers") {
      total += val
        .split("|")
        .map((s) => s.trim())
        .filter(Boolean).length;
      continue;
    }
    if (key === "with_companies" || key === "with_networks") {
      const parts = val
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      total += parts.length > 0 ? parts.length : 1;
      continue;
    }
    total += 1;
  }
  return total;
};

export const countCatalogFilterBadge = (
  urlRecord: Record<string, string>,
  discoverFilters: Record<string, string>,
): number => {
  let n = countDiscoverFilterSelections(discoverFilters);
  if (urlRecord.year?.trim()) {
    n += 1;
  }
  return n;
};
