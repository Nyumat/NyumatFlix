import "server-only";

import {
  getCachedAnilistTvAllSeasons,
  getCachedAnilistTvSeasonDetails,
} from "@/lib/anilist-tv-detail";
import { movieDb } from "@/lib/constants";
import {
  isAnilistBackedTvRouteId,
  type TvDetailCatalog,
} from "@/lib/tv-detail-catalog";
import { isTmdbNotFoundError } from "@/lib/tmdb-errors";
import { unwrapTmdbLookupId } from "@/lib/tmdb-anime-route-id";
import {
  CACHE_REVALIDATE_SECONDS,
  CACHE_SEASON_REVALIDATE_SECONDS,
} from "@/lib/http-cache";
import { tmdbFetchInit } from "@/lib/tmdb-cache-policy";
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

const SEASON_DETAIL_BATCH_SIZE = 6;

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

export async function fetchTVShowDetails(id: string): Promise<TvShowDetails> {
  const tmdbId = unwrapTmdbLookupId(id);
  const TV_DETAIL_APPEND =
    "content_ratings,keywords,external_ids,videos,images,recommendations,similar,reviews,credits";

  try {
    const url = new URL(`https://api.themoviedb.org/3/tv/${tmdbId}`);
    url.searchParams.set("api_key", process.env.TMDB_API_KEY ?? "");
    url.searchParams.set("language", "en-US");
    url.searchParams.set("append_to_response", TV_DETAIL_APPEND);

    const response = await fetch(
      url,
      tmdbFetchInit({
        endpoint: `/tv/${tmdbId}`,
        params: { append_to_response: TV_DETAIL_APPEND },
        revalidate: CACHE_REVALIDATE_SECONDS,
      }),
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch TV show details: ${response.status}`);
    }

    const data = await response.json();

    return {
      ...data,
      content_rating: pickTvCertification(data.content_ratings),
      logo: pickEnglishLogo(data.images?.logos),
    };
  } catch (error) {
    console.error(error);
    throw new Error("Failed to fetch TV show details");
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
    const tmdbDetail = await movieDb.tvInfo({ id: tmdbId });
    return (tmdbDetail ?? null) as TvShowDetails | null;
  } catch (error) {
    if (isTmdbNotFoundError(error)) {
      return null;
    }
    throw error;
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

  const tmdbId = unwrapTmdbLookupId(tvId);

  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/tv/${tmdbId}/season/${seasonNumber}?api_key=${process.env.TMDB_API_KEY}&language=en-US`,
      tvSeasonFetchInit(tmdbId, seasonNumber),
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch season details: ${response.status}`);
    }
    return toSlimSeasonDetails(await response.json());
  } catch (error) {
    console.error(error);
    return null;
  }
}

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

  const allSeasonDetails: Record<number, SeasonDetails> = {};

  for (let i = 0; i < regularSeasons.length; i += SEASON_DETAIL_BATCH_SIZE) {
    const batch = regularSeasons.slice(i, i + SEASON_DETAIL_BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((season: Season) =>
        fetchSeasonDetailsServer(tvId, season.season_number, options).catch(
          () => null,
        ),
      ),
    );

    batchResults.forEach((seasonDetail) => {
      if (seasonDetail) {
        allSeasonDetails[seasonDetail.season_number] = seasonDetail;
      }
    });
  }

  return allSeasonDetails;
}
