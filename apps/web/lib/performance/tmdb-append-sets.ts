export const DETAIL_SHELL_APPEND_MOVIE = "external_ids,credits,release_dates";

export const DETAIL_SHELL_APPEND_TV = "external_ids,credits,content_ratings";

export const DETAIL_TAB_APPEND =
  "images,recommendations,similar,reviews,videos,keywords";

export type DetailAppendMode = "shell" | "full";

export const movieDetailAppend = (mode: DetailAppendMode): string =>
  mode === "shell"
    ? DETAIL_SHELL_APPEND_MOVIE
    : `${DETAIL_SHELL_APPEND_MOVIE},${DETAIL_TAB_APPEND}`;

export const tvDetailAppend = (mode: DetailAppendMode): string =>
  mode === "shell"
    ? DETAIL_SHELL_APPEND_TV
    : `${DETAIL_SHELL_APPEND_TV},${DETAIL_TAB_APPEND}`;
