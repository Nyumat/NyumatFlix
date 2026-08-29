import { cancelResponseBody, scrapeFetch } from "../fetch";
import {
  SCRAPE_PLAY_PROBE_RETRY_ATTEMPTS,
  SCRAPE_PLAY_PROBE_TIMEOUT_MS,
  probeScrapePlaybackPath,
} from "../playback-probe";

export const HLS_PLAYLIST_PROBE_TIMEOUT_MS = SCRAPE_PLAY_PROBE_TIMEOUT_MS;

/** Vivibebe sometimes returns ad/decoy playlists with image segments. */
export const isBaitHlsPlaylist = (body: string): boolean =>
  /ibyteimg\.com/i.test(body) ||
  /no valid url found/i.test(body) ||
  /#EXTINF:[^\n]*\n[^\n]*\.(?:png|jpe?g|gif|webp)(?:\?|\s|$)/i.test(body);

export const probeHlsPlaylistBody = async (
  streamUrl: string,
  referer: string,
): Promise<string | null> => {
  try {
    const response = await scrapeFetch(streamUrl, {
      headers: { Referer: referer },
      timeoutMs: HLS_PLAYLIST_PROBE_TIMEOUT_MS,
      retryAttempts: SCRAPE_PLAY_PROBE_RETRY_ATTEMPTS,
    });
    if (response.status !== 200) {
      await cancelResponseBody(response);
      return null;
    }

    return await response.text();
  } catch {
    return null;
  }
};

export const isPlayableHlsStream = async (
  streamUrl: string,
  referer: string,
): Promise<boolean> => {
  try {
    const body = await probeHlsPlaylistBody(streamUrl, referer);
    if (!body?.includes("#EXTM3U") || isBaitHlsPlaylist(body)) {
      return false;
    }

    return probeScrapePlaybackPath(
      {
        url: streamUrl,
        referer,
      },
      "hls",
      {
        timeoutMs: HLS_PLAYLIST_PROBE_TIMEOUT_MS,
        retryAttempts: SCRAPE_PLAY_PROBE_RETRY_ATTEMPTS,
      },
    );
  } catch {
    return false;
  }
};
