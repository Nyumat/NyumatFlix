import "server-only";

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

const tvDetailFetchInit = (id: string, append: string) =>
  tmdbFetchInit({
    endpoint: `/tv/${id}`,
    params: { append_to_response: append },
    revalidate: CACHE_REVALIDATE_SECONDS,
  });

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

/**
 * Fetches details for a TV show by ID
 */
export async function fetchTVShowDetails(id: string): Promise<TvShowDetails> {
  try {
    const baseUrl = `https://api.themoviedb.org/3/tv/${id}?api_key=${process.env.TMDB_API_KEY}&language=en-US`;

    const [res1, res2, res3] = await Promise.all([
      fetch(
        `${baseUrl}&append_to_response=content_ratings,keywords,external_ids`,
        tvDetailFetchInit(id, "content_ratings,keywords,external_ids"),
      ),
      fetch(
        `${baseUrl}&append_to_response=videos,images`,
        tvDetailFetchInit(id, "videos,images"),
      ),
      fetch(
        `${baseUrl}&append_to_response=recommendations,similar,reviews`,
        tvDetailFetchInit(id, "recommendations,similar,reviews"),
      ),
    ]);

    if (!res1.ok || !res2.ok || !res3.ok) {
      throw new Error(
        `Failed to fetch TV show details: ${res1.status} ${res2.status} ${res3.status}`,
      );
    }

    const [data1, data2, data3] = await Promise.all([
      res1.json(),
      res2.json(),
      res3.json(),
    ]);

    const data: TvShowDetails = {
      ...data1,
      ...data2,
      ...data3,
      credits: {
        cast: [],
        crew: [],
      },
      content_rating: pickTvCertification(data1.content_ratings),
      logo: pickEnglishLogo(data2.images?.logos),
    };

    return data;
  } catch (error) {
    console.error(error);
    throw new Error("Failed to fetch TV show details");
  }
}

/**
 * Fetches details for a specific season of a TV show (server-side)
 */
export async function fetchSeasonDetailsServer(
  tvId: string,
  seasonNumber: number,
): Promise<SeasonDetails | null> {
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

/**
 * Fetches details for a specific season of a TV show (client-side)
 */
export async function fetchAllSeasonDetails(
  tvId: string,
  seasons: Season[] | undefined,
): Promise<Record<number, SeasonDetails>> {
  const regularSeasons =
    seasons?.filter(
      (season: Season) => season.season_number > 0 && season.episode_count > 0,
    ) || [];

  const allSeasonDetails: Record<number, SeasonDetails> = {};

  for (let i = 0; i < regularSeasons.length; i += SEASON_DETAIL_BATCH_SIZE) {
    const batch = regularSeasons.slice(i, i + SEASON_DETAIL_BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((season: Season) =>
        fetchSeasonDetailsServer(tvId, season.season_number).catch(() => null),
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
