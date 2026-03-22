export const MOVIE_VIEWS = [
  "discover",
  "popular",
  "now_playing",
  "top_rated",
  "trending",
] as const;

export type MovieCatalogView = (typeof MOVIE_VIEWS)[number];

export const TV_VIEWS = [
  "discover",
  "popular",
  "top_rated",
  "airing_today",
  "on_the_air",
  "trending",
] as const;

export type TvCatalogView = (typeof TV_VIEWS)[number];

export const parseMovieView = (value: string | undefined): MovieCatalogView => {
  if (value === "upcoming") return "discover";
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

export const CATALOG_UI_PARAM_KEYS = ["mode"] as const;

export type CatalogUiMode = "results";

export const stripCatalogUiParams = (
  sp: Record<string, string>,
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(sp).filter(
      ([key]) => !(CATALOG_UI_PARAM_KEYS as readonly string[]).includes(key),
    ),
  );

const catalogBase = {
  movie: "/movies",
  tv: "/tvshows",
} as const;

type BuildCatalogCtaUrlOptions = {
  view?: MovieCatalogView | TvCatalogView;
  mode?: CatalogUiMode;
  trendingTime?: "day" | "week";
  extra?: Record<string, string | undefined>;
};

export const buildCatalogCtaUrl = (
  mediaType: "movie" | "tv",
  { view, mode, trendingTime = "day", extra }: BuildCatalogCtaUrlOptions = {},
): string => {
  const params = new URLSearchParams();

  if (view && view !== "discover") {
    params.set("view", view);
  }

  if (view === "trending") {
    params.set("trending_time", trendingTime);
  }

  if (mode) {
    params.set("mode", mode);
  }

  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v !== undefined && v !== "") {
        params.set(k, v);
      }
    }
  }

  const qs = params.toString();
  const base = catalogBase[mediaType];
  return qs ? `${base}?${qs}` : base;
};

export const parseTrendingTime = (value: string | undefined): "day" | "week" =>
  value === "week" ? "week" : "day";
