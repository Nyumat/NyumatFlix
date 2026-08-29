import { getCachedAnilistTvShowDetail } from "@/lib/anilist-tv-detail";
import {
  isAnilistTvRouteId,
  parseAnimeAnilistRouteId,
} from "@/lib/anilist-route-id";
import { CACHE_REVALIDATE_SECONDS } from "@/lib/http-cache";
import { fetchTVShowDetails } from "@/lib/server/tvshow-api";
import { type MediaItem } from "@/lib/domain/typings";
import { pickEnglishLogo } from "@/lib/tmdb-logo";
import { tmdbFetchInit } from "@/lib/tmdb-cache-policy";
import { cache } from "react";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";

const MOVIE_DETAIL_APPEND =
  "keywords,external_ids,release_dates,videos,images,recommendations,similar,reviews,credits";

type ReleaseDatesAppend = {
  release_dates?: {
    results?: Array<{
      iso_3166_1?: string;
      release_dates?: Array<{
        certification?: string;
      }>;
    }>;
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

const movieDetailFetchInit = (id: string) =>
  tmdbFetchInit({
    endpoint: `/movie/${id}`,
    params: { append_to_response: MOVIE_DETAIL_APPEND },
    revalidate: CACHE_REVALIDATE_SECONDS,
  });

export const getCachedMovieDetail = cache(
  async (id: string): Promise<MediaItem | null> => {
    try {
      const url = new URL(`${TMDB_BASE_URL}/movie/${id}`);
      url.searchParams.set("api_key", process.env.TMDB_API_KEY ?? "");
      url.searchParams.set("language", "en-US");
      url.searchParams.set("append_to_response", MOVIE_DETAIL_APPEND);

      const response = await fetch(url, movieDetailFetchInit(id));

      if (!response.ok) {
        return null;
      }

      const data = await response.json();

      return {
        ...data,
        content_rating: pickMovieCertification(data),
        logo: pickEnglishLogo(data.images?.logos),
      };
    } catch {
      return null;
    }
  },
);

export type TvShowDetailCacheOptions = {
  animeCatalog?: boolean;
};

export const getCachedTvShowDetail = cache(
  (id: string, options?: TvShowDetailCacheOptions) => {
    const useAnilist = options?.animeCatalog
      ? parseAnimeAnilistRouteId(id) !== null
      : isAnilistTvRouteId(id);

    return useAnilist
      ? getCachedAnilistTvShowDetail(id, {
          acceptBareNumeric: options?.animeCatalog === true,
        })
      : fetchTVShowDetails(id);
  },
);
