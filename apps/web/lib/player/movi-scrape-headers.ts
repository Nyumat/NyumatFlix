import {
  NYUMAT_CLIENT_HEADER,
  NYUMAT_CLIENT_VALUE,
} from "@/lib/api/request-guard";
import { readAccessTokenFromUrl } from "@/lib/direct/transcode-hls-auth";

const INTERNAL_PLAYBACK_PREFIXES = [
  "/api/scrape/play/",
  "/api/live/play/",
  "/api/direct/media",
  "/api/direct/transcode/",
] as const;

const isInternalPlaybackPath = (pathname: string): boolean =>
  INTERNAL_PLAYBACK_PREFIXES.some((prefix) => pathname.startsWith(prefix));

const isInternalPlaybackUrl = (url: string): boolean => {
  if (INTERNAL_PLAYBACK_PREFIXES.some((prefix) => url.startsWith(prefix))) {
    return true;
  }

  try {
    return isInternalPlaybackPath(
      new URL(url, "http://local.invalid").pathname,
    );
  } catch {
    return false;
  }
};

/** Headers for movi-player native HLS / progressive requests (parity with scrape HLS fetchSetup). */
export const buildMoviScrapePlaybackHeaders = (
  playbackUrl: string,
): Record<string, string> => {
  const headers: Record<string, string> = {};

  if (isInternalPlaybackUrl(playbackUrl)) {
    headers[NYUMAT_CLIENT_HEADER] = NYUMAT_CLIENT_VALUE;
  }

  const token = readAccessTokenFromUrl(playbackUrl);
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};
