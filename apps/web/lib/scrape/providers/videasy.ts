import { cancelResponseBody, scrapeFetch } from "../fetch";
import type { ScrapeMediaInput, ScrapeResult } from "../types";
import { decryptVidKingPayload } from "../vidking-cipher";
import { wingsApiHeaders, wingsSourceUrl } from "../vidking-constants";
import { fetchWingsSeed } from "../wings-api-discover";
import { WINGS_SOURCE_FETCH_TIMEOUT_MS } from "../vidking-constants";
import {
  finalizeWingsdatabaseScrape,
  mapVidKingSubtitles,
  resolveWingsTmdbLookup,
} from "./vidking";

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
    let sawSources = false;
    let bestSubtitles: NonNullable<VidKingPayload["subtitles"]> = [];
    const referer = `${seedResult.origin}/`;

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
