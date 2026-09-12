import { getCachedAnilistTvShowDetail } from "@/lib/anilist-tv-detail";
import {
  isAnilistTvRouteId,
  parseAnimeAnilistRouteId,
} from "@/lib/anilist-route-id";
import { isKitsuAnimeRouteId } from "@/lib/kitsu/route-id";
import { isMalAnimeRouteId } from "@/lib/mal/route-id";
import { getKitsuAnimeDetail } from "@/lib/server/kitsu-anime-detail-route";
import { CACHE_REVALIDATE_SECONDS } from "@/lib/http-cache";
import {
  type DetailAppendMode,
  movieDetailAppend,
} from "@/lib/performance/tmdb-append-sets";
import { fetchTVShowDetails } from "@/lib/server/tvshow-api";
import { unwrapTmdbLookupId } from "@/lib/tmdb-anime-route-id";
import { type MediaItem } from "@/lib/domain/typings";
import { pickEnglishLogo } from "@/lib/tmdb-logo";
import { tmdbFetchInit } from "@/lib/tmdb-cache-policy";
import { withDevelopmentDataCache } from "@/lib/server/development-data-cache";
import { cache } from "react";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";

type ReleaseDatesAppend = {
  release_dates?: {
    results?: Array<{
      iso_3166_1?: string;
      release_dates?: Array<{
        certification?: string;
      }>;
    }>;
  };
  images?: {
    logos?: Array<{ iso_639_1?: string | null; file_path?: string }>;
  };
};

const pickMovieCertification = (raw: ReleaseDatesAppend): string | null => {
  const usRelease = raw.release_dates?.results?.find(
    (result) => result.iso_3166_1 === "US",
  );
  return (
    usRelease?.release_dates?.find((release) => release.certification)
      ?.certification ?? null
  );
};

const movieDetailFetchInit = (id: string, append: string) =>
  tmdbFetchInit({
    endpoint: `/movie/${id}`,
    params: { append_to_response: append },
    revalidate: CACHE_REVALIDATE_SECONDS,
  });

export type MovieDetailCacheOptions = {
  append?: DetailAppendMode;
};

const loadMovieDetail = async (
  tmdbId: string,
  appendMode: DetailAppendMode,
): Promise<MediaItem | null> => {
  const append = movieDetailAppend(appendMode);
  const url = new URL(`${TMDB_BASE_URL}/movie/${tmdbId}`);
  url.searchParams.set("api_key", process.env.TMDB_API_KEY ?? "");
  url.searchParams.set("language", "en-US");
  url.searchParams.set("append_to_response", append);

  const response = await fetch(url, movieDetailFetchInit(tmdbId, append));

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as ReleaseDatesAppend & MediaItem;

  return {
    ...data,
    content_rating: pickMovieCertification(data),
    logo: appendMode === "full" ? pickEnglishLogo(data.images?.logos) : null,
  };
};

export const getCachedMovieDetail = cache(
  async (
    id: string,
    options?: MovieDetailCacheOptions,
  ): Promise<MediaItem | null> => {
    const appendMode = options?.append ?? "shell";
    const tmdbId = unwrapTmdbLookupId(id);
    try {
      return await withDevelopmentDataCache({
        key: `movie-detail:${tmdbId}:${appendMode}`,
        load: () => loadMovieDetail(tmdbId, appendMode),
        cacheResult: (value) => value !== null,
      });
    } catch {
      return null;
    }
  },
);

export type TvShowDetailCacheOptions = {
  animeCatalog?: boolean;
  fetchEpisodes?: boolean;
  append?: DetailAppendMode;
};

const getCachedTvShowDetailCached = cache(
  async (
    id: string,
    animeCatalog: boolean,
    fetchEpisodes: boolean,
    append: DetailAppendMode,
  ) => {
    const useAnilist = animeCatalog
      ? parseAnimeAnilistRouteId(id) !== null
      : isAnilistTvRouteId(id);

    if (useAnilist) {
      return getCachedAnilistTvShowDetail(id, {
        acceptBareNumeric: animeCatalog,
      });
    }

    // Kitsu (`kitsu-{id}`) + Jikan/MAL (`mal-{id}`) fallback detail pages —
    // served from Kitsu so grids stay navigable when AniList is down.
    if (animeCatalog && (isKitsuAnimeRouteId(id) || isMalAnimeRouteId(id))) {
      try {
        return await getKitsuAnimeDetail(id);
      } catch {
        return null;
      }
    }

    try {
      return await fetchTVShowDetails(unwrapTmdbLookupId(id), {
        fetchEpisodes,
        append,
      });
    } catch {
      return null;
    }
  },
);

export const getCachedTvShowDetail = (
  id: string,
  options?: TvShowDetailCacheOptions,
) =>
  getCachedTvShowDetailCached(
    id,
    options?.animeCatalog === true,
    options?.fetchEpisodes === true,
    options?.append ?? "shell",
  );
