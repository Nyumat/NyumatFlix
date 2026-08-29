import { isMatching, P } from "ts-pattern";

export const MOVIE_STATUSES = {
  RUMORED: "Rumored",
  PLANNED: "Planned",
  IN_PRODUCTION: "In Production",
  POST_PRODUCTION: "Post Production",
  RELEASED: "Released",
  CANCELED: "Canceled",
} as const;

export type MovieStatus = (typeof MOVIE_STATUSES)[keyof typeof MOVIE_STATUSES];

interface MovieDetails {
  status?: string;
  revenue?: number;
  runtime?: number;
  vote_average?: number;
  vote_count?: number;
}

const upcomingStatusPattern = P.union(
  MOVIE_STATUSES.RUMORED,
  MOVIE_STATUSES.PLANNED,
  MOVIE_STATUSES.IN_PRODUCTION,
  MOVIE_STATUSES.POST_PRODUCTION,
);

const releasedStatusPattern = MOVIE_STATUSES.RELEASED;

export const isUpcomingMovie = (
  movie: MovieDetails & { release_date?: string },
): boolean => {
  if (!movie) return false;

  const hasUpcomingStatus = isMatching(
    { status: upcomingStatusPattern },
    movie,
  );

  if (isMatching({ status: releasedStatusPattern }, movie)) {
    return false;
  }

  if (hasUpcomingStatus) {
    return true;
  }

  const now = new Date();
  const releaseDate = movie.release_date ? new Date(movie.release_date) : null;

  if (
    releaseDate &&
    releaseDate < new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000)
  ) {
    return false;
  }

  const criticalMissingFields = [movie.runtime || 0, movie.vote_count || 0];

  const missingCriticalFields = criticalMissingFields.filter(
    (field) => field === 0,
  ).length;

  const isFutureRelease = releaseDate && releaseDate > now;
  const hasSignificantMissingData = missingCriticalFields >= 2;

  return (
    isFutureRelease ||
    (hasSignificantMissingData &&
      (!releaseDate ||
        releaseDate > new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)))
  );
};

export const getStatusDisplayText = (status: string): string => {
  return status || "Unknown Status";
};
