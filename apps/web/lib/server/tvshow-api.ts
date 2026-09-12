import "server-only";

import {
  getCachedAnilistTvAllSeasons,
  getCachedAnilistTvSeasonDetails,
} from "@/lib/anilist-tv-detail";
import {
  isAnilistBackedTvRouteId,
  type TvDetailCatalog,
} from "@/lib/tv-detail-catalog";
import { isTmdbNotFoundError, TmdbHttpError } from "@/lib/tmdb-errors";
import { fetchTmdbSplitCourMergedSeasonDetails } from "@/lib/anime/tmdb-split-cour-season";
import {
  getCachedTmdbResponse,
  tmdbTvCacheTag,
} from "@/lib/server/tmdb-response-cache";
import { unwrapTmdbLookupId } from "@/lib/tmdb-anime-route-id";
import {
  CACHE_REVALIDATE_SECONDS,
  CACHE_SEASON_REVALIDATE_SECONDS,
} from "@/lib/http-cache";
import {
  type DetailAppendMode,
  tvDetailAppend,
} from "@/lib/performance/tmdb-append-sets";
import { tmdbFetchInit } from "@/lib/tmdb-cache-policy";
import { withDevelopmentDataCache } from "@/lib/server/development-data-cache";
import { pickEnglishLogo } from "@/lib/tmdb-logo";
import type {
  Episode,
  Season,
  SeasonDetails,
  TvShowDetails,
} from "@/lib/domain/typings";

type RawEpisode = {
  air_date?: unknown;
  episode_number?: unknown;
  id?: unknown;
  name?: unknown;
  overview?: unknown;
  runtime?: unknown;
  still_path?: unknown;
  vote_average?: unknown;
  vote_count?: unknown;
};

type RawSeasonDetails = {
  episodes?: unknown;
  id?: unknown;
  name?: unknown;
  overview?: unknown;
  season_number?: unknown;
};

const SEASON_FETCH_CONCURRENCY = 5;

const readString = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;

const readNullableString = (value: unknown) =>
  typeof value === "string" ? value : null;

const readNumber = (value: unknown, fallback = 0) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const readNullableNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const pickTvCertification = (
  contentRatings: TvShowDetails["content_ratings"] | undefined,
) => {
  const usRating = contentRatings?.results.find(
    (rating) => rating.iso_3166_1 === "US",
  );
  return usRating?.rating || null;
};

const tvSeasonFetchInit = (tvId: string, seasonNumber: number) =>
  tmdbFetchInit({
    endpoint: `/tv/${tvId}/season/${seasonNumber}`,
    revalidate: CACHE_SEASON_REVALIDATE_SECONDS,
  });

const toSlimEpisode = (
  episode: RawEpisode,
  index: number,
  seasonNumber: number,
): Episode => {
  const episodeNumber = readNumber(episode.episode_number, index + 1);
  return {
    id: readNumber(episode.id, seasonNumber * 1000 + episodeNumber),
    name: readString(episode.name),
    overview: readString(episode.overview),
    episode_number: episodeNumber,
    air_date: readString(episode.air_date),
    still_path: readNullableString(episode.still_path),
    runtime: readNullableNumber(episode.runtime),
    vote_average: readNumber(episode.vote_average),
    vote_count: readNumber(episode.vote_count),
  };
};

const toSlimSeasonDetails = (raw: RawSeasonDetails): SeasonDetails | null => {
  const seasonNumber = readNumber(raw.season_number, Number.NaN);
  if (!Number.isFinite(seasonNumber)) {
    return null;
  }

  const episodes = Array.isArray(raw.episodes)
    ? raw.episodes
        .filter((episode): episode is RawEpisode => {
          return typeof episode === "object" && episode !== null;
        })
        .map((episode, index) => toSlimEpisode(episode, index, seasonNumber))
    : [];

  return {
    id: readNumber(raw.id),
    name: readString(raw.name, `Season ${seasonNumber}`),
    overview: readString(raw.overview),
    season_number: seasonNumber,
    episodes,
  };
};

export type FetchTVShowDetailsOptions = {
  fetchEpisodes?: boolean;
  append?: DetailAppendMode;
};

export async function fetchTVShowDetails(
  id: string,
  options?: FetchTVShowDetailsOptions,
): Promise<TvShowDetails> {
  const tmdbId = unwrapTmdbLookupId(id);
  const appendMode = options?.append ?? "shell";
  const append = tvDetailAppend(appendMode);

  try {
    const details = await withDevelopmentDataCache({
      key: `tv-detail:${tmdbId}:${appendMode}`,
      load: async () => {
        const url = new URL(`https://api.themoviedb.org/3/tv/${tmdbId}`);
        url.searchParams.set("api_key", process.env.TMDB_API_KEY ?? "");
        url.searchParams.set("language", "en-US");
        url.searchParams.set("append_to_response", append);

        const response = await fetch(
          url,
          tmdbFetchInit({
            endpoint: `/tv/${tmdbId}`,
            params: { append_to_response: append },
            revalidate: CACHE_REVALIDATE_SECONDS,
          }),
        );

        if (!response.ok) {
          throw new TmdbHttpError(
            response.status,
            `Failed to fetch TV show details: ${response.status}`,
          );
        }

        const data = await response.json();

        return {
          ...data,
          content_rating: pickTvCertification(data.content_ratings),
          logo:
            appendMode === "full" ? pickEnglishLogo(data.images?.logos) : null,
        } as TvShowDetails;
      },
    });

    if (options?.fetchEpisodes) {
      return {
        ...details,
        allSeasonDetails: await fetchAllSeasonDetails(id, details.seasons),
      };
    }

    return details;
  } catch (error) {
    if (isTmdbNotFoundError(error)) {
      throw error;
    }

    console.error(error);
    throw error instanceof Error
      ? error
      : new Error("Failed to fetch TV show details");
  }
}

export type TvSeasonFetchOptions = {
  catalog?: TvDetailCatalog | null;
  source?: "tmdb" | "auto";
};

const anilistSeasonResolveOptions = (catalog: TvDetailCatalog | null) =>
  catalog === "anime" ? { acceptBareNumeric: true as const } : undefined;

const shouldResolveAnilistSeason = (
  tvId: string,
  options?: TvSeasonFetchOptions,
): boolean =>
  options?.source !== "tmdb" &&
  isAnilistBackedTvRouteId(tvId, options?.catalog ?? null);

export async function resolveTvShowDetailForApiRoute(
  id: string,
): Promise<TvShowDetails | null> {
  const tmdbId = unwrapTmdbLookupId(id);

  try {
    return await fetchTVShowDetails(tmdbId, { append: "shell" });
  } catch (error) {
    if (isTmdbNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}

export async function resolveTmdbSeasonDetails(
  tvId: string,
  seasonNumber: number,
): Promise<SeasonDetails | null> {
  const numericTmdbId = Number.parseInt(unwrapTmdbLookupId(tvId), 10);
  if (!Number.isInteger(numericTmdbId) || numericTmdbId <= 0) {
    return null;
  }

  const merged = await fetchTmdbSplitCourMergedSeasonDetails(
    numericTmdbId,
    seasonNumber,
  );

  if (merged) {
    return merged;
  }

  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/tv/${numericTmdbId}/season/${seasonNumber}?api_key=${process.env.TMDB_API_KEY}&language=en-US`,
      tvSeasonFetchInit(String(numericTmdbId), seasonNumber),
    );
    if (!response.ok) {
      if (response.status !== 404) {
        console.error(`Failed to fetch season details: ${response.status}`);
      }
      return null;
    }
    return toSlimSeasonDetails(await response.json());
  } catch (error) {
    console.error(error);
    return null;
  }
}

export async function fetchSeasonDetailsServer(
  tvId: string,
  seasonNumber: number,
  options?: TvSeasonFetchOptions,
): Promise<SeasonDetails | null> {
  if (shouldResolveAnilistSeason(tvId, options)) {
    return getCachedAnilistTvSeasonDetails(
      tvId,
      seasonNumber,
      anilistSeasonResolveOptions(options?.catalog ?? null),
    );
  }

  return resolveTmdbSeasonDetails(tvId, seasonNumber);
}

const fetchSeasonsConcurrent = async (
  tvId: string,
  seasons: Season[],
  options?: TvSeasonFetchOptions,
): Promise<Record<number, SeasonDetails>> => {
  const allSeasonDetails: Record<number, SeasonDetails> = {};
  const queue = [...seasons];
  const workers = Array.from(
    { length: Math.min(SEASON_FETCH_CONCURRENCY, queue.length) },
    async () => {
      while (queue.length > 0) {
        const season = queue.shift();
        if (!season) break;
        const seasonDetail = await fetchSeasonDetailsServer(
          tvId,
          season.season_number,
          options,
        ).catch(() => null);
        if (seasonDetail) {
          allSeasonDetails[seasonDetail.season_number] = seasonDetail;
        }
      }
    },
  );
  await Promise.all(workers);
  return allSeasonDetails;
};

export async function fetchAllSeasonDetails(
  tvId: string,
  seasons: Season[] | undefined,
  options?: TvSeasonFetchOptions,
): Promise<Record<number, SeasonDetails>> {
  if (shouldResolveAnilistSeason(tvId, options)) {
    return getCachedAnilistTvAllSeasons(
      tvId,
      anilistSeasonResolveOptions(options?.catalog ?? null),
    );
  }

  const regularSeasons =
    seasons?.filter(
      (season: Season) => season.season_number > 0 && season.episode_count > 0,
    ) || [];

  return fetchSeasonsConcurrent(tvId, regularSeasons, options);
}

export const getCachedAllSeasonDetailsForShow = async (
  tvId: string,
  seasons: Season[] | undefined,
  options?: TvSeasonFetchOptions,
): Promise<Record<number, SeasonDetails>> =>
  getCachedTmdbResponse({
    cacheKey: `tv-all-seasons:${unwrapTmdbLookupId(tvId)}:${options?.catalog ?? "tvshows"}`,
    tags: [tmdbTvCacheTag(unwrapTmdbLookupId(tvId))],
    revalidateSeconds: 3600,
    memoryFallback: true,
    load: () => fetchAllSeasonDetails(tvId, seasons, options),
  });
