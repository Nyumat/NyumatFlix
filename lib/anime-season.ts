export type AniListSeason = "WINTER" | "SPRING" | "SUMMER" | "FALL";

export type AnimeSeasonContext = {
  /** Season currently on the air (e.g. Spring 2026 in June). */
  currentSeason: AniListSeason;
  currentYear: number;
  currentLabel: string;
  /** Marquee season for the hub hero + primary rows (e.g. Summer 2026 in June). */
  featuredSeason: AniListSeason;
  featuredYear: number;
  featuredLabel: string;
};

const SEASON_LABELS: Record<AniListSeason, string> = {
  WINTER: "Winter",
  SPRING: "Spring",
  SUMMER: "Summer",
  FALL: "Fall",
};

export const formatAnimeSeasonLabel = (season: AniListSeason, year: number) =>
  `${SEASON_LABELS[season]} ${year}`;

/** AniList broadcast season for a calendar month. */
export const getAniListSeasonForMonth = (month: number): AniListSeason => {
  if (month <= 3) return "WINTER";
  if (month <= 6) return "SPRING";
  if (month <= 9) return "SUMMER";
  return "FALL";
};

/**
 * Crunchyroll-style marquee season: preview the upcoming slate in the last month
 * of each broadcast block (Jun → Summer, Mar → Spring, etc.).
 */
export const getFeaturedSeason = (
  month: number,
  year: number,
): { season: AniListSeason; year: number } => {
  const current = getAniListSeasonForMonth(month);

  if (month === 6) return { season: "SUMMER", year };
  if (month === 3) return { season: "SPRING", year };
  if (month === 9) return { season: "FALL", year };
  if (month === 12) return { season: "WINTER", year: year + 1 };

  return { season: current, year };
};

export const getAnimeSeasonContext = (
  date: Date = new Date(),
): AnimeSeasonContext => {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  const currentSeason = getAniListSeasonForMonth(month);
  const featured = getFeaturedSeason(month, year);

  return {
    currentSeason,
    currentYear: year,
    currentLabel: formatAnimeSeasonLabel(currentSeason, year),
    featuredSeason: featured.season,
    featuredYear: featured.year,
    featuredLabel: formatAnimeSeasonLabel(featured.season, featured.year),
  };
};
