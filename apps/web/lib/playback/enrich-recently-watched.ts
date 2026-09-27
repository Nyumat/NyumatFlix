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
  /** Present when the detail was resolved from AniList (or mapping resolved). */
  sourceAnilistId?: number | null;
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

const readImdbId = (detail: unknown): string | undefined => {
  if (!detail || typeof detail !== "object") return undefined;
  const external = (detail as { external_ids?: { imdb_id?: string | null } })
    .external_ids?.imdb_id;
  if (typeof external === "string" && external.startsWith("tt")) {
    return external;
  }
  const fromRoot = (detail as { imdb_id?: string | null }).imdb_id;
  return typeof fromRoot === "string" && fromRoot.startsWith("tt")
    ? fromRoot
    : undefined;
};

/**
 * A verified AniList id for the stub. `catalog === "anime"` means the detail
 * was fetched from AniList by `stub.contentId`, so the id is real. Otherwise
 * only trust an explicit `sourceAnilistId` — never reuse `stub.contentId`,
 * which may be a TMDB id that numerically collides with an unrelated AniList
 * entry.
 */
const resolveVerifiedAnilistId = (
  stub: RecentlyWatchedStub,
  fetched: FetchedTvDetailForEnrichment | null,
): number | null => {
  const sourceAnilistId = fetched?.detail.sourceAnilistId;
  if (
    typeof sourceAnilistId === "number" &&
    Number.isInteger(sourceAnilistId) &&
    sourceAnilistId > 0
  ) {
    return sourceAnilistId;
  }

  return fetched?.catalog === "anime" ? stub.contentId : null;
};

/**
 * Media-only enrichment for a title. Deliberately excludes stub-owned fields
 * (progress, updatedAt, season/episode) so it can be cached per title and
 * reused while the stub keeps changing.
 */
export type RecentlyWatchedEnrichment = {
  title?: string;
  backdropPath?: string | null;
  posterPath?: string | null;
  voteAverage?: number;
  year?: string;
  isAnime: boolean;
  anilistId?: number | null;
  imdbId?: string | null;
  lastAiredSeason?: number;
  lastAiredEpisode?: number;
  showStatus?: string | null;
  hasNextEpisode?: boolean;
};

export const fetchRecentlyWatchedEnrichment = async (
  stub: RecentlyWatchedStub,
  fetchers: RecentlyWatchedEnrichmentFetchers,
  options?: EnrichRecentlyWatchedOptions,
): Promise<RecentlyWatchedEnrichment | null> => {
  const includeTvCompleteFields = options?.includeTvCompleteFields ?? true;

  if (stub.mediaType === "movie") {
    const detail = await fetchers.fetchMovie(stub.contentId);
    if (!detail) {
      return stub.title ? { isAnime: false } : null;
    }

    if (!detail.title && !stub.title) {
      return null;
    }

    return {
      title: detail.title,
      backdropPath: detail.backdrop_path,
      posterPath: detail.poster_path,
      voteAverage: detail.vote_average,
      year: detail.release_date
        ? String(new Date(detail.release_date).getFullYear())
        : undefined,
      isAnime: false,
      imdbId: readImdbId(detail),
    };
  }

  const fetched = await fetchers.fetchTv(stub);
  if (!fetched) {
    return stub.title ? { isAnime: false } : null;
  }

  const detail = fetched.detail;
  if (!detail.name && !stub.title) {
    return null;
  }

  const tvFields = includeTvCompleteFields
    ? tvCompleteFieldsFromDetail(detail)
    : {};

  return {
    title: detail.name,
    backdropPath: detail.backdrop_path,
    posterPath: detail.poster_path,
    voteAverage: detail.vote_average,
    year: detail.first_air_date?.substring(0, 4),
    isAnime: fetched.catalog === "anime" || fetchers.isAnimeTvDetail(detail),
    anilistId: resolveVerifiedAnilistId(stub, fetched),
    imdbId: readImdbId(detail),
    ...tvFields,
  };
};

/** Overlay the current stub onto cached enrichment to build a render item. */
export const applyRecentlyWatchedEnrichment = (
  stub: RecentlyWatchedStub,
  enrichment: RecentlyWatchedEnrichment,
): RecentlyWatchedItem | null => {
  const title = enrichment.title ?? stub.title;
  if (!title) {
    return null;
  }

  return toRecentlyWatchedItem(stub, {
    title,
    backdropPath: enrichment.backdropPath ?? stub.backdropPath,
    posterPath: enrichment.posterPath ?? stub.posterPath,
    voteAverage: enrichment.voteAverage ?? stub.voteAverage,
    year: enrichment.year ?? stub.year,
    isAnime: enrichment.isAnime,
    anilistId: enrichment.anilistId,
    imdbId: enrichment.imdbId,
    lastAiredSeason: enrichment.lastAiredSeason,
    lastAiredEpisode: enrichment.lastAiredEpisode,
    showStatus: enrichment.showStatus,
    hasNextEpisode: enrichment.hasNextEpisode,
  });
};

export const enrichRecentlyWatchedStub = async (
  stub: RecentlyWatchedStub,
  fetchers: RecentlyWatchedEnrichmentFetchers,
  options?: EnrichRecentlyWatchedOptions,
): Promise<RecentlyWatchedItem | null> => {
  const enrichment = await fetchRecentlyWatchedEnrichment(
    stub,
    fetchers,
    options,
  );
  return enrichment ? applyRecentlyWatchedEnrichment(stub, enrichment) : null;
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
