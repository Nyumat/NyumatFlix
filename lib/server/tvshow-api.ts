import "server-only";

import {
  CACHE_REVALIDATE_SECONDS,
  CACHE_SEASON_REVALIDATE_SECONDS,
} from "@/lib/http-cache";
import {
  LogoSchema,
  Season,
  SeasonDetails,
  TvShowDetails,
} from "@/lib/domain/typings";

type TmdbLogo = {
  iso_639_1?: string | null;
};

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

/**
 * Fetches details for a TV show by ID
 */
export async function fetchTVShowDetails(id: string): Promise<TvShowDetails> {
  try {
    const baseUrl = `https://api.themoviedb.org/3/tv/${id}?api_key=${process.env.TMDB_API_KEY}&language=en-US`;
    const fetchOptions = { next: { revalidate: CACHE_REVALIDATE_SECONDS } };

    const [res1, res2, res3] = await Promise.all([
      fetch(
        `${baseUrl}&append_to_response=content_ratings,keywords,external_ids`,
        fetchOptions,
      ),
      fetch(`${baseUrl}&append_to_response=videos,images`, fetchOptions),
      fetch(
        `${baseUrl}&append_to_response=recommendations,similar,reviews`,
        fetchOptions,
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
      { next: { revalidate: CACHE_SEASON_REVALIDATE_SECONDS } },
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch season details: ${response.status}`);
    }
    return await response.json();
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
    seasons?.filter((season: Season) => season.season_number > 0) || [];

  const allSeasonDetailsPromises = regularSeasons.map((season: Season) =>
    fetchSeasonDetailsServer(tvId, season.season_number).catch(() => null),
  );

  const allSeasonDetailsArray = await Promise.all(allSeasonDetailsPromises);
  const allSeasonDetails: Record<number, SeasonDetails> = {};

  allSeasonDetailsArray.forEach((seasonDetail) => {
    if (seasonDetail) {
      allSeasonDetails[seasonDetail.season_number] = seasonDetail;
    }
  });

  return allSeasonDetails;
}
