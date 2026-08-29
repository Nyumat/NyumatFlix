import type { HlsConfig } from "hls.js";

import {
  NYUMAT_CLIENT_HEADER,
  NYUMAT_CLIENT_VALUE,
} from "@/lib/api/request-guard";

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

const resolvePlaybackRequestUrl = (url: string): string => {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  if (typeof window !== "undefined") {
    return new URL(url, window.location.href).toString();
  }

  return url;
};

export const mergeScrapeHlsClientAuthConfig = (
  baseConfig: Partial<HlsConfig>,
): Partial<HlsConfig> => ({
  ...baseConfig,
  fetchSetup: (context, initParams) => {
    if (!isInternalPlaybackUrl(context.url)) {
      return new Request(resolvePlaybackRequestUrl(context.url), initParams);
    }

    const headers = new Headers(initParams.headers);
    if (!headers.has(NYUMAT_CLIENT_HEADER)) {
      headers.set(NYUMAT_CLIENT_HEADER, NYUMAT_CLIENT_VALUE);
    }

    return new Request(resolvePlaybackRequestUrl(context.url), {
      ...initParams,
      headers,
    });
  },
});
