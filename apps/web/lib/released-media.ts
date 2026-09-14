import { hasPosterPath } from "@/lib/media-poster-path";

export const getTodayIsoDateUtc = (): string => {
  const n = new Date();
  const y = n.getUTCFullYear();
  const m = String(n.getUTCMonth() + 1).padStart(2, "0");
  const d = String(n.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const formatUtcIsoDate = (date: Date): string => {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

/** Rolling 365-day window ending today (UTC). */
export const getRollingYearDateRangeUtc = (): { gte: string; lte: string } => {
  const lte = getTodayIsoDateUtc();
  const end = new Date(`${lte}T00:00:00.000Z`);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 365);
  return { gte: formatUtcIsoDate(start), lte };
};

/** Exclude recent releases from hub picks (TMDB hype / sparse votes). */
export const getAcclaimedHubMovieReleaseDateLte = (
  minAgeDays = 540,
): string => {
  const today = getTodayIsoDateUtc();
  const cutoff = new Date(`${today}T00:00:00.000Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - minAgeDays);
  return formatUtcIsoDate(cutoff);
};

export const isoDateToAniListFuzzyDateInt = (isoDate: string): number =>
  Number.parseInt(isoDate.replace(/-/g, ""), 10);

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
  T extends {
    release_date?: string | null;
    poster_path?: string | null;
  },
>(
  items: T[] | null | undefined,
): T[] =>
  (items ?? []).filter(
    (m) => isReleasedMovieByDate(m.release_date) && hasPosterPath(m),
  );

export const filterReleasedTvShows = <
  T extends {
    first_air_date?: string | null;
    poster_path?: string | null;
  },
>(
  items: T[] | null | undefined,
): T[] =>
  (items ?? []).filter(
    (s) => isPremieredTvByDate(s.first_air_date) && hasPosterPath(s),
  );

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
