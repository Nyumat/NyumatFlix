export const MOVIE_VIEWS = [
  "discover",
  "popular",
  "now_playing",
  "top_rated",
  "upcoming",
] as const;

export type MovieCatalogView = (typeof MOVIE_VIEWS)[number];

export const TV_VIEWS = [
  "discover",
  "popular",
  "top_rated",
  "airing_today",
  "on_the_air",
] as const;

export type TvCatalogView = (typeof TV_VIEWS)[number];

export const parseMovieView = (value: string | undefined): MovieCatalogView => {
  if (value && (MOVIE_VIEWS as readonly string[]).includes(value)) {
    return value as MovieCatalogView;
  }
  return "discover";
};

export const parseTvView = (value: string | undefined): TvCatalogView => {
  if (value && (TV_VIEWS as readonly string[]).includes(value)) {
    return value as TvCatalogView;
  }
  return "discover";
};
