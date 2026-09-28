import { cancelResponseBody, scrapeFetch } from "./fetch";
import {
  createMetadataCache,
  SCRAPE_METADATA_MAX_ENTRIES,
  SCRAPE_METADATA_TTL_MS,
} from "./metadata-cache";
import type { ScrapeMediaInput } from "./types";

export type WingsTmdbLookup = {
  title: string;
  year: string;
  imdbId: string;
};

const tmdbLookupCache = createMetadataCache<WingsTmdbLookup>({
  ttlMs: SCRAPE_METADATA_TTL_MS,
  maxEntries: SCRAPE_METADATA_MAX_ENTRIES,
});

export const clearWingsTmdbLookupCache = (): void => {
  tmdbLookupCache.clear();
};

const fetchWingsTmdbLookup = async (
  input: ScrapeMediaInput,
  apiKey: string,
): Promise<WingsTmdbLookup | null> => {
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

/** show-level metadata only, so the key ignores season and episode. */
export const resolveWingsTmdbLookup = async (
  input: ScrapeMediaInput,
): Promise<WingsTmdbLookup | null> => {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return null;
  }

  const load = () =>
    tmdbLookupCache.get(`${input.mediaType}:${input.tmdbId}`, () =>
      fetchWingsTmdbLookup(input, apiKey),
    );

  return input.timing ? input.timing.time("metadata", load) : load();
};
