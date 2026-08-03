import { cancelResponseBody, scrapeFetch } from "../fetch";
import type { ScrapeMediaInput, ScrapeResult } from "../types";
import { finalizeWingsdatabaseScrape, mapVidKingSubtitles } from "./vidking";

const VIDEASY_ORIGIN = "https://player.videasy.net";
const WINGS_API = "https://api.wingsdatabase.com";

/** VidEasy embed mirrors (wingsdatabase) — richer set than VidKing. */
const VIDEASY_SOURCE_ENDPOINTS = [
  "cdn/sources-with-title",
  "downloader2/sources-with-title",
  "neon2/sources-with-title",
  "jett/sources-with-title",
  "tejo/sources-with-title",
  "ym/sources-with-title",
  "m4uhd/sources-with-title",
  "hdmovie/sources-with-title",
  "superflix/sources-with-title",
] as const;

type VidKingPayload = {
  sources?: Array<{ quality?: string; type?: string; url?: string }>;
  subtitles?: Array<{
    lang?: string;
    label?: string;
    name?: string;
    kind?: string;
    url?: string;
  }>;
};

type VideasyLookup = {
  title: string;
  year: string;
  imdbId: string;
};

const resolveVideasyLookup = async (
  input: ScrapeMediaInput,
): Promise<VideasyLookup | null> => {
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

  if (!title?.trim() || !imdbId) {
    return null;
  }

  return {
    title: title.trim(),
    year: date?.slice(0, 4) ?? "",
    imdbId,
  };
};

const fetchVideasyPayload = async (
  endpoint: string,
  input: ScrapeMediaInput,
  lookup: VideasyLookup,
  seed: string,
  headers: Record<string, string>,
): Promise<VidKingPayload | null> => {
  const seasonId = String(input.seasonNumber ?? 1);
  const episodeId = String(input.episodeNumber ?? 1);
  const params = new URLSearchParams({
    title: encodeURIComponent(encodeURIComponent(lookup.title)),
    mediaType: input.mediaType,
    year: lookup.year,
    episodeId,
    seasonId,
    tmdbId: String(input.tmdbId),
    imdbId: lookup.imdbId,
    enc: "2",
    seed,
  });

  const encryptedResponse = await scrapeFetch(
    `${WINGS_API}/${endpoint}?${params.toString()}`,
    {
      headers,
      timeoutMs: 8_000,
      curlFallback: false,
      retryAttempts: 1,
    },
  );

  if (!encryptedResponse.ok) {
    await cancelResponseBody(encryptedResponse);
    return null;
  }

  const encrypted = await encryptedResponse.text();
  if (encrypted.length < 50) {
    return null;
  }

  const { decryptVidKingPayload } = await import("../vidking-cipher");
  const decrypted = decryptVidKingPayload(encrypted, seed, input.tmdbId);

  return JSON.parse(decrypted) as VidKingPayload;
};

export async function scrapeVideasy(
  input: ScrapeMediaInput,
): Promise<ScrapeResult> {
  const providerId = "videasy";
  const headers = {
    Origin: VIDEASY_ORIGIN,
    Referer: `${VIDEASY_ORIGIN}/`,
  };

  try {
    const lookup = await resolveVideasyLookup(input);
    if (!lookup) {
      return {
        ok: false,
        providerId,
        error: "VidEasy TMDB metadata lookup failed",
      };
    }

    const seedResponse = await scrapeFetch(
      `${WINGS_API}/seed?mediaId=${input.tmdbId}`,
      { headers, retryAttempts: 1 },
    );

    if (!seedResponse.ok) {
      await cancelResponseBody(seedResponse);
      return {
        ok: false,
        providerId,
        error: `Seed request failed (${seedResponse.status})`,
      };
    }

    const seedPayload = (await seedResponse.json()) as { seed?: string };
    const seed = seedPayload.seed;
    if (!seed) {
      return { ok: false, providerId, error: "Missing VidEasy seed" };
    }

    let sawSources = false;
    let bestSubtitles: NonNullable<VidKingPayload["subtitles"]> = [];
    const referer = `${VIDEASY_ORIGIN}/`;

    const payloads = await Promise.all(
      VIDEASY_SOURCE_ENDPOINTS.map(async (mirror) => {
        try {
          const payload = await fetchVideasyPayload(
            mirror,
            input,
            lookup,
            seed,
            headers,
          );
          return { mirror, payload };
        } catch {
          return { mirror, payload: null };
        }
      }),
    );

    for (const { payload } of payloads) {
      if ((payload?.sources ?? []).length > 0) {
        sawSources = true;
      }
      if ((payload?.subtitles ?? []).length > bestSubtitles.length) {
        bestSubtitles = payload?.subtitles ?? [];
      }
    }

    const mappedSubtitles = mapVidKingSubtitles(bestSubtitles);

    return finalizeWingsdatabaseScrape({
      providerId,
      referer,
      payloads,
      mirrorOrder: VIDEASY_SOURCE_ENDPOINTS,
      mappedSubtitles,
      sawSources,
    });
  } catch (error) {
    return {
      ok: false,
      providerId,
      error:
        error instanceof Error
          ? error.message
          : "VidEasy scrape failed unexpectedly",
    };
  }
}
