export const getTodayIsoDateUtc = (): string => {
  const n = new Date();
  const y = n.getUTCFullYear();
  const m = String(n.getUTCMonth() + 1).padStart(2, "0");
  const d = String(n.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export const isReleasedMovieByDate = (
  releaseDate: string | null | undefined,
): boolean => {
  if (releaseDate == null || String(releaseDate).trim() === "") return false;
  const ymd = String(releaseDate).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  return ymd <= getTodayIsoDateUtc();
};

export const isPremieredTvByDate = (
  firstAirDate: string | null | undefined,
): boolean => {
  if (firstAirDate == null || String(firstAirDate).trim() === "") return false;
  const ymd = String(firstAirDate).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  return ymd <= getTodayIsoDateUtc();
};

export const filterReleasedMovies = <
  T extends { release_date?: string | null },
>(
  items: T[],
): T[] => items.filter((m) => isReleasedMovieByDate(m.release_date));

export const filterReleasedTvShows = <
  T extends { first_air_date?: string | null },
>(
  items: T[],
): T[] => items.filter((s) => isPremieredTvByDate(s.first_air_date));

export const clampDiscoverMovieLte = (
  requested: string | undefined,
  today: string,
): string => {
  if (!requested || requested > today) return today;
  return requested;
};

export const clampDiscoverTvLte = (
  requested: string | undefined,
  today: string,
): string => {
  if (!requested || requested > today) return today;
  return requested;
};
