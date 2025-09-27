import { isMatching, P } from "ts-pattern";

// Movie status constants
export const MOVIE_STATUSES = {
  RUMORED: "Rumored",
  PLANNED: "Planned",
  IN_PRODUCTION: "In Production",
  POST_PRODUCTION: "Post Production",
  RELEASED: "Released",
  CANCELED: "Canceled",
} as const;

export type MovieStatus = (typeof MOVIE_STATUSES)[keyof typeof MOVIE_STATUSES];

// Movie details type for the function parameter
interface MovieDetails {
  status?: string;
  revenue?: number;
  runtime?: number;
  vote_average?: number;
  vote_count?: number;
}

// Define patterns for upcoming movie statuses using ts-pattern
const upcomingStatusPattern = P.union(
  MOVIE_STATUSES.RUMORED,
  MOVIE_STATUSES.PLANNED,
  MOVIE_STATUSES.IN_PRODUCTION,
  MOVIE_STATUSES.POST_PRODUCTION,
);

const releasedStatusPattern = MOVIE_STATUSES.RELEASED;

// Check if a movie is upcoming based on status and missing data using ts-pattern
export const isUpcomingMovie = (
  movie: MovieDetails & { release_date?: string },
): boolean => {
  if (!movie) return false;

  // Check if movie has upcoming status using pattern matching
  const hasUpcomingStatus = isMatching(
    { status: upcomingStatusPattern },
    movie,
  );

  // If explicitly marked as "Released", don't treat as upcoming regardless of missing data
  if (isMatching({ status: releasedStatusPattern }, movie)) {
    return false;
  }

  // If has clear upcoming status, it's upcoming
  if (hasUpcomingStatus) {
    return true;
  }

  // For movies without clear status, check release date and missing data
  const now = new Date();
  const releaseDate = movie.release_date ? new Date(movie.release_date) : null;

  // Don't flag movies as upcoming if they're more than 6 months old
  if (
    releaseDate &&
    releaseDate < new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000)
  ) {
    return false;
  }

  // For recent/future movies without status, check for missing data (more selective)
  // Only consider runtime and vote_count as indicators (revenue can be missing for indie films)
  const criticalMissingFields = [movie.runtime || 0, movie.vote_count || 0];

  const missingCriticalFields = criticalMissingFields.filter(
    (field) => field === 0,
  ).length;

  // Only flag as upcoming if it's a future release or very recent with missing critical data
  const isFutureRelease = releaseDate && releaseDate > now;
  const hasSignificantMissingData = missingCriticalFields >= 2;

  return (
    isFutureRelease ||
    (hasSignificantMissingData &&
      (!releaseDate ||
        releaseDate > new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)))
  );
};

// Get status display text
export const getStatusDisplayText = (status: string): string => {
  return status || "Unknown Status";
};
