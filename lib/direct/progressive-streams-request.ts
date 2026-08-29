export type ProgressiveDirectStreamRequest =
  | {
      mediaType: "movie";
      tmdbId: number;
      fresh?: boolean;
    }
  | {
      mediaType: "tv";
      tmdbId: number;
      season: number;
      episode: number;
      fresh?: boolean;
    };
