import "server-only";

import { randomBytes } from "node:crypto";

import { scrapeFetch } from "../fetch";
import {
  SCRAPE_PLAY_PROBE_RETRY_ATTEMPTS,
  SCRAPE_PLAY_PROBE_TIMEOUT_MS,
  probeScrapePlaybackPath,
} from "../playback-probe";
import { firstOkInBatches } from "../race-first";
import type { ScrapeMediaInput, ScrapeResult } from "../types";
import {
  decryptHexaApiResponse,
  encHexaCapToken,
  HEXA_FINGERPRINT_LITE,
} from "../hexa-cipher";
import {
  extractEncDecPlayableStreams,
  mapEncDecQualities,
  mapEncDecSubtitles,
} from "../enc-dec/stream-extract";

const HEXA_ORIGIN = "https://hexa.su";
const HEXA_API = "https://theemoviedb.hexa.su/api/tmdb";

export const buildHexaApiUrl = (input: ScrapeMediaInput): string => {
  if (input.mediaType === "movie") {
    return `${HEXA_API}/movie/${input.tmdbId}/images`;
  }

  const season = input.seasonNumber ?? 1;
  const episode = input.episodeNumber ?? 1;
  return `${HEXA_API}/tv/${input.tmdbId}/season/${season}/episode/${episode}/images`;
};

export async function scrapeHexa(
  input: ScrapeMediaInput,
): Promise<ScrapeResult> {
  const providerId = "hexa" as const;

  try {
    const apiKey = randomBytes(32).toString("hex");
    const challengeToken = await encHexaCapToken({ signal: input.signal });

    const headers = {
      Accept: "text/plain,application/json,*/*",
      Referer: `${HEXA_ORIGIN}/`,
      Origin: HEXA_ORIGIN,
      "X-Fingerprint-Lite": HEXA_FINGERPRINT_LITE,
      "X-Api-Key": apiKey,
      "X-Cap-Token": challengeToken,
    };

    const encryptedResponse = await scrapeFetch(buildHexaApiUrl(input), {
      headers,
      timeoutMs: SCRAPE_PLAY_PROBE_TIMEOUT_MS,
      retryAttempts: SCRAPE_PLAY_PROBE_RETRY_ATTEMPTS,
      signal: input.signal,
    });

    if (!encryptedResponse.ok) {
      return {
        ok: false,
        providerId,
        error: `Hexa API failed (${encryptedResponse.status})`,
      };
    }

    const encrypted = await encryptedResponse.text();
    const payload = await decryptHexaApiResponse(encrypted, apiKey, {
      signal: input.signal,
    });

    const referer = `${HEXA_ORIGIN}/`;
    const streams = extractEncDecPlayableStreams(payload, referer);
    if (streams.length === 0) {
      return {
        ok: false,
        providerId,
        error: "Hexa returned no playable streams",
      };
    }

    const winner = await firstOkInBatches(
      streams,
      async (stream) => {
        const kind = /\.mp4(?:[?#]|$)/i.test(stream.url) ? "mp4" : "hls";
        const streamReferer = stream.referer ?? referer;
        const ok = await probeScrapePlaybackPath(
          { url: stream.url, referer: streamReferer },
          kind,
          { signal: input.signal },
        );
        if (!ok) {
          return null;
        }
        return { ...stream, referer: streamReferer };
      },
      3,
      { signal: input.signal },
    );

    if (!winner) {
      return {
        ok: false,
        providerId,
        error: "Hexa streams failed playback probe",
      };
    }

    const { url: streamUrl, referer: streamReferer } = winner.value;
    const subtitles = mapEncDecSubtitles(payload, streamReferer);
    const qualities = mapEncDecQualities(streams, streamUrl, streamReferer);

    return {
      ok: true,
      providerId,
      streamUrl,
      referer: streamReferer,
      validated: true,
      ...(subtitles ? { subtitles } : {}),
      ...(qualities ? { qualities } : {}),
    };
  } catch (error) {
    return {
      ok: false,
      providerId,
      error: error instanceof Error ? error.message : "Hexa scrape failed",
    };
  }
}
