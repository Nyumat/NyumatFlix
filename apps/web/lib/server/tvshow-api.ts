import "server-only";

import {
  getCachedAnilistTvAllSeasons,
  getCachedAnilistTvSeasonDetails,
} from "@/lib/anilist-tv-detail";
import {
  isAnilistBackedTvRouteId,
  type TvDetailCatalog,
} from "@/lib/tv-detail-catalog";
import {
  CACHE_REVALIDATE_SECONDS,
  CACHE_SEASON_REVALIDATE_SECONDS,
} from "@/lib/http-cache";
import { tmdbFetchInit } from "@/lib/tmdb-cache-policy";
import { LogoSchema } from "@/lib/domain/typings";
import type {
  Episode,
  Season,
  SeasonDetails,
  TvShowDetails,
} from "@/lib/domain/typings";

type TmdbLogo = {
  iso_639_1?: string | null;
};

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

const SEASON_DETAIL_BATCH_SIZE = 3;

const readString = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;

const readNullableString = (value: unknown) =>
  typeof value === "string" ? value : null;

const readNumber = (value: unknown, fallback = 0) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const readNullableNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const pickEnglishLogo = (logos: unknown) => {
  if (!Array.isArray(logos) || logos.length === 0) {
    return undefined;
  }

  const selected =
    logos.find((logo): logo is TmdbLogo => {
      return (
        typeof logo === "object" &&
        logo !== null &&
        "iso_639_1" in logo &&
        logo.iso_639_1 === "en"
      );
    }) ?? logos[0];

  const result = LogoSchema.safeParse(selected);
  return result.success ? result.data : undefined;
};

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
  const TV_DETAIL_APPEND =
    "content_ratings,keywords,external_ids,videos,images,recommendations,similar,reviews,credits";

  try {
    const url = new URL(`https://api.themoviedb.org/3/tv/${id}`);
    url.searchParams.set("api_key", process.env.TMDB_API_KEY ?? "");
    url.searchParams.set("language", "en-US");
    url.searchParams.set("append_to_response", TV_DETAIL_APPEND);

    const response = await fetch(
      url,
      tmdbFetchInit({
        endpoint: `/tv/${id}`,
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
};

const anilistSeasonResolveOptions = (catalog: TvDetailCatalog | null) =>
  catalog === "anime" ? { acceptBareNumeric: true as const } : undefined;

export async function fetchSeasonDetailsServer(
  tvId: string,
  seasonNumber: number,
  options?: TvSeasonFetchOptions,
): Promise<SeasonDetails | null> {
  if (isAnilistBackedTvRouteId(tvId, options?.catalog ?? null)) {
    return getCachedAnilistTvSeasonDetails(
      tvId,
      seasonNumber,
      anilistSeasonResolveOptions(options?.catalog ?? null),
    );
  }

  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/tv/${tvId}/season/${seasonNumber}?api_key=${process.env.TMDB_API_KEY}&language=en-US`,
      tvSeasonFetchInit(tvId, seasonNumber),
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
  if (isAnilistBackedTvRouteId(tvId, options?.catalog ?? null)) {
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
