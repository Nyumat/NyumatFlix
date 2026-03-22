import { filterDiscoverParams } from "@/lib/utils";

const DEFAULT_DISCOVER_SORT = "popularity.desc";

const hasNonEmptyDiscoverFilters = (filters: Record<string, string>): boolean =>
  Object.values(filters).some(
    (v) => v !== undefined && String(v).trim() !== "",
  );

export const isDiscoverDefaultQuery = (
  searchParams: Record<string, string>,
): boolean => {
  const sortRaw = searchParams.sort_by?.trim();
  const effectiveSort =
    sortRaw && sortRaw !== "" ? sortRaw : DEFAULT_DISCOVER_SORT;
  if (effectiveSort !== DEFAULT_DISCOVER_SORT) return false;

  if (searchParams.year?.trim()) return false;
  if (searchParams.type?.trim() || searchParams.filter?.trim()) return false;

  const filters = filterDiscoverParams(searchParams);
  return !hasNonEmptyDiscoverFilters(filters);
};
