export const queryKeys = {
  all: ["nyumatflix"] as const,

  contentRows: () => [...queryKeys.all, "content-rows"] as const,
  contentRow: (rowId: string, options?: { count?: number; enrich?: boolean }) =>
    [...queryKeys.contentRows(), rowId, options] as const,

  search: () => [...queryKeys.all, "search"] as const,
  searchPreview: (query: string) =>
    [...queryKeys.search(), "preview", query] as const,
  searchResults: (query: string, page: number) =>
    [...queryKeys.search(), "results", query, page] as const,

  genres: () => [...queryKeys.all, "genres"] as const,
  movieGenres: () => [...queryKeys.genres(), "movie"] as const,
  tvGenres: () => [...queryKeys.genres(), "tv"] as const,
  combinedGenres: () => [...queryKeys.genres(), "combined"] as const,

  media: () => [...queryKeys.all, "media"] as const,
  tvSeason: (tvId: number, seasonNumber: number) =>
    [...queryKeys.media(), "tv", tvId, "season", seasonNumber] as const,
  movieDetails: (movieId: number) =>
    [...queryKeys.media(), "movie", movieId] as const,
  tvDetails: (tvId: number) => [...queryKeys.media(), "tv", tvId] as const,
} as const;

export type QueryKeys = typeof queryKeys;
