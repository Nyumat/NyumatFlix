export const TMDB_SHOW_TO_ANILIST_OVERRIDES: Readonly<Record<number, number>> =
  {};

export const TMDB_SHOW_TO_MAL_OVERRIDES: Readonly<Record<number, number>> = {
  233643: 56497,
};

export const overrideAnilistIdForTmdbShow = (
  tmdbShowId: number,
): number | null => {
  const anilistId = TMDB_SHOW_TO_ANILIST_OVERRIDES[tmdbShowId];
  return typeof anilistId === "number" && anilistId > 0 ? anilistId : null;
};

export const overrideMalIdForTmdbShow = (tmdbShowId: number): number | null => {
  const malId = TMDB_SHOW_TO_MAL_OVERRIDES[tmdbShowId];
  return typeof malId === "number" && malId > 0 ? malId : null;
};
