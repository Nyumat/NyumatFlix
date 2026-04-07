export const shouldKeepZeroRevenueMovie = (item: {
  media_type?: string;
  status?: string;
  revenue?: number;
  release_date?: string;
}): boolean => {
  if (item.media_type === "tv" || (!item.media_type && !item.status)) {
    return true;
  }

  if (item.status && item.status !== "Released") {
    return true;
  }

  if (item.revenue === undefined || item.revenue === null) {
    return true;
  }

  if (item.revenue === 0 && item.status === "Released") {
    return false;
  }

  return true;
};

export const filterZeroRevenueMovies = <
  T extends {
    media_type?: string;
    status?: string;
    revenue?: number;
    release_date?: string;
  },
>(
  items: T[],
): T[] => items.filter(shouldKeepZeroRevenueMovie);
