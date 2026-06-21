import { CACHE_REVALIDATE_SECONDS } from "@/lib/http-cache";
import { fetchTVShowDetails } from "@/lib/server/tvshow-api";
import { LogoSchema, type MediaItem } from "@/lib/domain/typings";
import { tmdbFetchInit } from "@/lib/tmdb-cache-policy";
import { cache } from "react";

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

const pickEnglishLogo = (logos: unknown) => {
  if (!Array.isArray(logos) || logos.length === 0) {
    return undefined;
  }

  const selected =
    logos.find((logo) => {
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

const movieDetailFetchInit = (id: string, append: string) =>
  tmdbFetchInit({
    endpoint: `/movie/${id}`,
    params: { append_to_response: append },
    revalidate: CACHE_REVALIDATE_SECONDS,
  });

export const getCachedMovieDetail = cache(
  async (id: string): Promise<MediaItem | null> => {
    try {
      const baseUrl = `https://api.themoviedb.org/3/movie/${id}?api_key=${process.env.TMDB_API_KEY}&language=en-US`;

      const [res1, res2, res3] = await Promise.all([
        fetch(
          `${baseUrl}&append_to_response=keywords,external_ids,release_dates`,
          movieDetailFetchInit(id, "keywords,external_ids,release_dates"),
        ),
        fetch(
          `${baseUrl}&append_to_response=videos,images`,
          movieDetailFetchInit(id, "videos,images"),
        ),
        fetch(
          `${baseUrl}&append_to_response=recommendations,similar,reviews`,
          movieDetailFetchInit(id, "recommendations,similar,reviews"),
        ),
      ]);

      if (!res1.ok || !res2.ok || !res3.ok) {
        return null;
      }

      const [data1, data2, data3] = await Promise.all([
        res1.json(),
        res2.json(),
        res3.json(),
      ]);

      const data = {
        ...data1,
        ...data2,
        ...data3,
        content_rating: pickMovieCertification(data1),
        credits: {
          cast: [],
          crew: [],
        },
        logo: pickEnglishLogo(data2.images?.logos),
      };

      return data;
    } catch {
      return null;
    }
  },
);

export const getCachedTvShowDetail = cache((id: string) =>
  fetchTVShowDetails(id),
);
