import "server-only";

import { scrapeFetch } from "../fetch";
import {
  SCRAPE_PLAY_PROBE_RETRY_ATTEMPTS,
  SCRAPE_PLAY_PROBE_TIMEOUT_MS,
  probeScrapePlaybackPath,
} from "../playback-probe";
import { firstOkInBatches } from "../race-first";
import type { ScrapeMediaInput, ScrapeResult } from "../types";
import {
  extractEncDecPlayableStreams,
  mapEncDecQualities,
  mapEncDecSubtitles,
} from "../enc-dec/stream-extract";
import { encryptVidlinkMediaId } from "../vidlink-cipher";

const VIDLINK_ORIGIN = "https://vidlink.pro";

export const buildVidlinkApiUrl = (
  input: ScrapeMediaInput,
  encryptedTmdbId: string,
): string => {
  if (input.mediaType === "movie") {
    return `${VIDLINK_ORIGIN}/api/b/movie/${encryptedTmdbId}`;
  }

  const season = input.seasonNumber ?? 1;
  const episode = input.episodeNumber ?? 1;
  return `${VIDLINK_ORIGIN}/api/b/tv/${encryptedTmdbId}/${season}/${episode}`;
};

export const vidlinkScrapeHeaders = (): Record<string, string> => ({
  Accept: "application/json",
  Origin: VIDLINK_ORIGIN,
  Referer: `${VIDLINK_ORIGIN}/`,
});

export const encryptVidlinkTmdbId = (tmdbId: number): string =>
  encryptVidlinkMediaId(tmdbId);

export async function scrapeVidlink(
  input: ScrapeMediaInput,
): Promise<ScrapeResult> {
  const providerId = "vidlink" as const;

  try {
    const encrypted = encryptVidlinkTmdbId(input.tmdbId);
    const apiUrl = `${buildVidlinkApiUrl(input, encrypted)}?multiLang=1`;
    const response = await scrapeFetch(apiUrl, {
      headers: vidlinkScrapeHeaders(),
      timeoutMs: SCRAPE_PLAY_PROBE_TIMEOUT_MS,
      retryAttempts: SCRAPE_PLAY_PROBE_RETRY_ATTEMPTS,
      signal: input.signal,
    });

    if (!response.ok) {
      return {
        ok: false,
        providerId,
        error: `VidLink API failed (${response.status})`,
      };
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return {
        ok: false,
        providerId,
        error: "VidLink API returned invalid JSON",
      };
    }

    const referer = vidlinkScrapeHeaders().Referer ?? `${VIDLINK_ORIGIN}/`;
    const streams = extractEncDecPlayableStreams(payload, referer);
    if (streams.length === 0) {
      return {
        ok: false,
        providerId,
        error: "VidLink returned no playable streams",
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
        error: "VidLink streams failed playback probe",
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
      error: error instanceof Error ? error.message : "VidLink scrape failed",
    };
  }
}
