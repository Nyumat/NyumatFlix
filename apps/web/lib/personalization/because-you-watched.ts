import type { MovieWithMediaType, TvShowWithMediaType } from "@/tmdb/models";

export const BECAUSE_YOU_WATCHED_LIMIT = 20;
export const BECAUSE_YOU_WATCHED_SEED_FETCH_CHUNK_SIZE = 4;
export const BECAUSE_YOU_WATCHED_SEED_LIMIT = 12;

export type BecauseYouWatchedSeed =
  | {
      contentId: number;
      seedTitle: string;
      mediaType: "movie";
      items: MovieWithMediaType[];
    }
  | {
      contentId: number;
      seedTitle: string;
      mediaType: "tv";
      items: TvShowWithMediaType[];
    };

export type BecauseYouWatchedResult = BecauseYouWatchedSeed & {
  seeds: BecauseYouWatchedSeed[];
};
