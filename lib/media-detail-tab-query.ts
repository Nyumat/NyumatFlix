const TV_TAB_PATH_SEGMENTS = new Set([
  "overview",
  "seasons-episodes",
  "credits",
  "reviews",
  "series-graph",
  "images",
  "videos",
  "recommendations",
  "similar",
]);

const MOVIE_TAB_PATH_SEGMENTS = new Set([
  "credits",
  "reviews",
  "images",
  "videos",
  "recommendations",
  "similar",
]);

export const isLegacyTvDetailTabPathSegment = (segment: string): boolean =>
  TV_TAB_PATH_SEGMENTS.has(segment) || segment === "seasons";

export const isLegacyMovieDetailTabPathSegment = (segment: string): boolean =>
  MOVIE_TAB_PATH_SEGMENTS.has(segment);
