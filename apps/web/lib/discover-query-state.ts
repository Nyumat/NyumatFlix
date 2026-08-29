import { filterDiscoverParams } from "@/lib/utils";

export const DEFAULT_DISCOVER_SORT = "popularity.desc";

export const getEffectiveDiscoverSort = (
  sortBy: string | undefined,
): string => {
  const raw = sortBy?.trim();
  return raw && raw !== "" ? raw : DEFAULT_DISCOVER_SORT;
};

const hasNonEmptyDiscoverFilters = (filters: Record<string, string>): boolean =>
  Object.values(filters).some(
    (v) => v !== undefined && String(v).trim() !== "",
  );

export const hasActiveDiscoverFilters = (
  searchParams: Record<string, string>,
): boolean => {
  const filters = filterDiscoverParams(searchParams);
  return hasNonEmptyDiscoverFilters(filters);
};

export const isDiscoverDefaultQuery = (
  searchParams: Record<string, string>,
): boolean => {
  const effectiveSort = getEffectiveDiscoverSort(searchParams.sort_by);
  if (effectiveSort !== DEFAULT_DISCOVER_SORT) return false;

  if (searchParams.year?.trim()) return false;
  if (searchParams.type?.trim() || searchParams.filter?.trim()) return false;

  const filters = filterDiscoverParams(searchParams);
  return !hasNonEmptyDiscoverFilters(filters);
};
