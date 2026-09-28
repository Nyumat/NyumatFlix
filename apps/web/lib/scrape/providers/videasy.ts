import { cancelResponseBody, scrapeFetch } from "../fetch";
import type { ScrapeMediaInput, ScrapeResult } from "../types";
import { decryptVidKingPayload } from "../vidking-cipher";
import { wingsApiHeaders, wingsSourceUrl } from "../vidking-constants";
import { fetchWingsSeed } from "../wings-api-discover";
import { WINGS_SOURCE_FETCH_TIMEOUT_MS } from "../vidking-constants";
import { resolveWingsTmdbLookup } from "../tmdb-lookup";
import { scrapeWingsdatabaseMirrors } from "./vidking";

/** VidEasy embed mirrors (speedracelight / VideoPlayer 2026-08). */
const VIDEASY_SOURCE_ENDPOINTS = [
  "cdn/sources-with-title",
  "downloader2/sources-with-title",
  "vsrc/sources-with-title",
  "m4uhd/sources-with-title",
  "hdmovie/sources-with-title",
  "superflix/sources-with-title",
  "lamovie/sources-with-title",
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

const fetchVideasyPayload = async (
  endpoint: string,
  input: ScrapeMediaInput,
  lookup: { title: string; year: string; imdbId: string },
  seed: string,
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<VidKingPayload | null> => {
  const encryptedResponse = await scrapeFetch(
    wingsSourceUrl(endpoint, {
      title: lookup.title,
      mediaType: input.mediaType,
      year: lookup.year,
      tmdbId: input.tmdbId,
      imdbId: lookup.imdbId,
      seasonId: String(input.seasonNumber ?? 1),
      episodeId: String(input.episodeNumber ?? 1),
      seed,
    }),
    {
      headers,
      timeoutMs: WINGS_SOURCE_FETCH_TIMEOUT_MS,
      curlFallback: false,
      retryAttempts: 1,
      signal,
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

  const decrypted = decryptVidKingPayload(encrypted, seed, input.tmdbId);

  return JSON.parse(decrypted) as VidKingPayload;
};

export async function scrapeVideasy(
  input: ScrapeMediaInput,
): Promise<ScrapeResult> {
  const providerId = "videasy";

  try {
    const lookup = await resolveWingsTmdbLookup(input);
    if (!lookup) {
      return {
        ok: false,
        providerId,
        error: "VidEasy TMDB metadata lookup failed",
      };
    }

    const seedResult = await fetchWingsSeed("videasy", input.tmdbId);
    if (!seedResult.ok) {
      return {
        ok: false,
        providerId,
        error: seedResult.error,
      };
    }

    const seed = seedResult.seed;
    const headers = wingsApiHeaders(seedResult.origin);

    return scrapeWingsdatabaseMirrors({
      providerId,
      referer: `${seedResult.origin}/`,
      mirrors: VIDEASY_SOURCE_ENDPOINTS,
      fetchPayload: (mirror, signal) =>
        fetchVideasyPayload(mirror, input, lookup, seed, headers, signal),
      input,
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
