import type { MovieWithMediaType, TvShowWithMediaType } from "@/tmdb/models";

export const BECAUSE_YOU_WATCHED_LIMIT = 20;
export const BECAUSE_YOU_WATCHED_SEED_ATTEMPTS = 3;

export type BecauseYouWatchedResult =
  | {
      seedTitle: string;
      mediaType: "movie";
      items: MovieWithMediaType[];
    }
  | {
      seedTitle: string;
      mediaType: "tv";
      items: TvShowWithMediaType[];
    };
