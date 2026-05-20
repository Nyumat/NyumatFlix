export const queryKeys = {
  all: ["nyumatflix"] as const,

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
  mediaAboveFold: (mediaType: "movie" | "tv", id: string) =>
    [...queryKeys.media(), mediaType, id, "above-fold"] as const,

  tvAllSeasons: (tvId: string) =>
    [...queryKeys.media(), "tv", tvId, "all-seasons"] as const,
  tvTabCredits: (tvId: string) =>
    [...queryKeys.media(), "tv", tvId, "tab", "credits"] as const,
  tvTabImages: (tvId: string) =>
    [...queryKeys.media(), "tv", tvId, "tab", "images"] as const,
  tvTabVideos: (tvId: string) =>
    [...queryKeys.media(), "tv", tvId, "tab", "videos"] as const,
  tvTabReviews: (tvId: string, page: string) =>
    [...queryKeys.media(), "tv", tvId, "tab", "reviews", page] as const,
  tvTabRecommendations: (tvId: string, page: string) =>
    [...queryKeys.media(), "tv", tvId, "tab", "recommendations", page] as const,
  tvTabSimilar: (tvId: string, page: string) =>
    [...queryKeys.media(), "tv", tvId, "tab", "similar", page] as const,

  movieTabCredits: (movieId: string) =>
    [...queryKeys.media(), "movie", movieId, "tab", "credits"] as const,
  movieTabImages: (movieId: string) =>
    [...queryKeys.media(), "movie", movieId, "tab", "images"] as const,
  movieTabVideos: (movieId: string) =>
    [...queryKeys.media(), "movie", movieId, "tab", "videos"] as const,
  movieTabReviews: (movieId: string, page: string) =>
    [...queryKeys.media(), "movie", movieId, "tab", "reviews", page] as const,
  movieTabRecommendations: (movieId: string, page: string) =>
    [
      ...queryKeys.media(),
      "movie",
      movieId,
      "tab",
      "recommendations",
      page,
    ] as const,
  movieTabSimilar: (movieId: string, page: string) =>
    [...queryKeys.media(), "movie", movieId, "tab", "similar", page] as const,
  movieCollection: (collectionId: number) =>
    [...queryKeys.media(), "collection", collectionId] as const,
} as const;

export type QueryKeys = typeof queryKeys;
