import { cancelResponseBody, scrapeFetch } from "./fetch";
import type { ScrapeMediaInput } from "./types";

export type WingsTmdbLookup = {
  title: string;
  year: string;
  imdbId: string;
};

export const resolveWingsTmdbLookup = async (
  input: ScrapeMediaInput,
): Promise<WingsTmdbLookup | null> => {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return null;
  }

  const path =
    input.mediaType === "movie"
      ? `movie/${input.tmdbId}`
      : `tv/${input.tmdbId}`;
  const response = await scrapeFetch(
    `https://api.themoviedb.org/3/${path}?api_key=${apiKey}&language=en-US&append_to_response=external_ids`,
    { retryAttempts: 1 },
  );

  if (!response.ok) {
    await cancelResponseBody(response);
    return null;
  }

  const data = (await response.json()) as {
    title?: string;
    name?: string;
    release_date?: string;
    first_air_date?: string;
    imdb_id?: string | null;
    external_ids?: { imdb_id?: string | null };
  };

  const title = input.mediaType === "movie" ? data.title : data.name;
  const date =
    input.mediaType === "movie" ? data.release_date : data.first_air_date;
  const imdbId = data.external_ids?.imdb_id ?? data.imdb_id ?? "";

  if (!title?.trim()) {
    return null;
  }

  return {
    title: title.trim(),
    year: date?.slice(0, 4) ?? "",
    imdbId,
  };
};
