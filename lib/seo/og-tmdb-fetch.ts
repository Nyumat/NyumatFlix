import "server-only";

import { unstable_cache } from "next/cache";

const TMDB_BASE = "https://api.themoviedb.org/3";
const OG_TMDB_REVALIDATE_SECONDS = 86400;

export type OgMovieDetail = {
  title?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  release_date?: string;
  runtime?: number;
  tagline?: string;
  genres?: Array<{ name: string }>;
};

export type OgTvDetail = {
  name?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  first_air_date?: string;
  last_air_date?: string;
  number_of_seasons?: number;
  tagline?: string;
  genres?: Array<{ name: string }>;
};

async function tmdbOgFetch<T>(path: string): Promise<T | null> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `${TMDB_BASE}${path}?api_key=${apiKey}&language=en-US`;
    const response = await fetch(url, {
      next: { revalidate: OG_TMDB_REVALIDATE_SECONDS },
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export const fetchOgMovieDetail = (id: string) =>
  tmdbOgFetch<OgMovieDetail>(`/movie/${id}`);

export const fetchOgTvDetail = (id: string) =>
  tmdbOgFetch<OgTvDetail>(`/tv/${id}`);

export type OgPersonCastCredit = {
  title?: string;
  name?: string;
  media_type?: string;
  genre_ids?: number[];
  popularity?: number;
  poster_path?: string | null;
};

const fetchOgPersonCastCreditsUncached = async (
  personId: number,
): Promise<OgPersonCastCredit[]> => {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return [];

  try {
    const url = `${TMDB_BASE}/person/${personId}/combined_credits?api_key=${apiKey}&language=en-US`;
    const response = await fetch(url, {
      next: { revalidate: OG_TMDB_REVALIDATE_SECONDS },
    });
    if (!response.ok) return [];

    const data = (await response.json()) as { cast?: OgPersonCastCredit[] };
    return data.cast ?? [];
  } catch {
    return [];
  }
};

export const fetchOgPersonCastCredits = (personId: number) =>
  unstable_cache(
    () => fetchOgPersonCastCreditsUncached(personId),
    ["og-person-credits", String(personId)],
    { revalidate: OG_TMDB_REVALIDATE_SECONDS },
  )();
