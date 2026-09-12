import { tvCompleteFieldsFromDetail } from "@/lib/playback/continue-watching-complete";
import {
  toRecentlyWatchedItem,
  type RecentlyWatchedItem,
  type RecentlyWatchedStub,
} from "@/lib/playback/recently-watched";

export type MovieDetailForEnrichment = {
  title?: string;
  backdrop_path?: string | null;
  poster_path?: string | null;
  vote_average?: number;
  release_date?: string;
};

export type TvDetailForEnrichment = {
  name?: string;
  backdrop_path?: string | null;
  poster_path?: string | null;
  vote_average?: number;
  first_air_date?: string;
  genre_ids?: number[];
  genres?: Array<{ id: number; name?: string }>;
  status?: string | null;
  last_episode_to_air?: unknown;
  next_episode_to_air?: unknown;
};

export type FetchedTvDetailForEnrichment = {
  detail: TvDetailForEnrichment;
  catalog: "anime" | null;
};

export type RecentlyWatchedEnrichmentFetchers = {
  fetchMovie: (contentId: number) => Promise<MovieDetailForEnrichment | null>;
  fetchTv: (
    stub: RecentlyWatchedStub,
  ) => Promise<FetchedTvDetailForEnrichment | null>;
  isAnimeTvDetail: (detail: TvDetailForEnrichment) => boolean;
};

export type EnrichRecentlyWatchedOptions = {
  includeTvCompleteFields?: boolean;
};

const readMovieTitle = (
  detail: MovieDetailForEnrichment,
  fallback?: string,
): string | undefined => detail.title ?? fallback;

export const enrichRecentlyWatchedStub = async (
  stub: RecentlyWatchedStub,
  fetchers: RecentlyWatchedEnrichmentFetchers,
  options?: EnrichRecentlyWatchedOptions,
): Promise<RecentlyWatchedItem | null> => {
  const includeTvCompleteFields = options?.includeTvCompleteFields ?? true;

  if (stub.mediaType === "movie") {
    const detail = await fetchers.fetchMovie(stub.contentId);
    if (!detail) {
      return stub.title
        ? toRecentlyWatchedItem(stub, {
            title: stub.title,
            backdropPath: stub.backdropPath,
            posterPath: stub.posterPath,
            isAnime: false,
          })
        : null;
    }

    const title = readMovieTitle(detail, stub.title);
    if (!title) {
      return null;
    }

    return toRecentlyWatchedItem(stub, {
      title,
      backdropPath: detail.backdrop_path ?? stub.backdropPath,
      posterPath: detail.poster_path ?? stub.posterPath,
      voteAverage: detail.vote_average ?? stub.voteAverage,
      year: detail.release_date
        ? String(new Date(detail.release_date).getFullYear())
        : stub.year,
      isAnime: false,
    });
  }

  const fetched = await fetchers.fetchTv(stub);
  if (!fetched) {
    return stub.title
      ? toRecentlyWatchedItem(stub, {
          title: stub.title,
          backdropPath: stub.backdropPath,
          posterPath: stub.posterPath,
          isAnime: false,
        })
      : null;
  }

  const detail = fetched.detail;
  const title = detail.name ?? stub.title;
  if (!title) {
    return null;
  }

  const tvFields = includeTvCompleteFields
    ? tvCompleteFieldsFromDetail(detail)
    : {};

  return toRecentlyWatchedItem(stub, {
    title,
    backdropPath: detail.backdrop_path ?? stub.backdropPath,
    posterPath: detail.poster_path ?? stub.posterPath,
    voteAverage: detail.vote_average ?? stub.voteAverage,
    year: detail.first_air_date?.substring(0, 4) ?? stub.year,
    isAnime: fetched.catalog === "anime" || fetchers.isAnimeTvDetail(detail),
    ...tvFields,
  });
};

export const enrichRecentlyWatchedStubs = async (
  stubs: RecentlyWatchedStub[],
  fetchers: RecentlyWatchedEnrichmentFetchers,
  options?: EnrichRecentlyWatchedOptions,
): Promise<RecentlyWatchedItem[]> => {
  const results = await Promise.all(
    stubs.map((stub) => enrichRecentlyWatchedStub(stub, fetchers, options)),
  );
  return results.filter((item): item is RecentlyWatchedItem => item !== null);
};

export const enrichRecentlyWatchedStubsChunked = async (
  stubs: RecentlyWatchedStub[],
  fetchers: RecentlyWatchedEnrichmentFetchers,
  options?: EnrichRecentlyWatchedOptions & { chunkSize?: number },
): Promise<RecentlyWatchedItem[]> => {
  const chunkSize = options?.chunkSize ?? 8;
  const results: RecentlyWatchedItem[] = [];

  for (let index = 0; index < stubs.length; index += chunkSize) {
    const chunk = stubs.slice(index, index + chunkSize);
    const chunkResults = await enrichRecentlyWatchedStubs(
      chunk,
      fetchers,
      options,
    );
    results.push(...chunkResults);
  }

  return results;
};
