import type { HlsConfig } from "hls.js";

import {
  appendAccessToken,
  isCalluspiratesPlaybackPath,
} from "@/lib/scrape/direct-proxy";

export function readAccessTokenFromUrl(url: string): string | null {
  try {
    const token = new URL(url, "http://local.invalid").searchParams.get(
      "access_token",
    );
    return token && token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

export function isDirectTranscodeHlsUrl(url: string): boolean {
  return (
    url.includes("/transcode/playlist") ||
    url.includes("/transcode/hls/") ||
    url.includes("/direct/transcode/playlist") ||
    url.includes("/direct/transcode/hls/")
  );
}

export function isCalluspiratesTranscodeResourceUrl(url: string): boolean {
  if (url.includes("/transcode/")) {
    return true;
  }
  try {
    const pathname = new URL(url, "http://local.invalid").pathname;
    return isCalluspiratesPlaybackPath(pathname);
  } catch {
    return false;
  }
}

function appendTokenToPlaylistResource(
  resource: string,
  token: string,
): string {
  if (!resource || resource.includes("access_token=")) {
    return resource;
  }
  if (!isCalluspiratesTranscodeResourceUrl(resource)) {
    return resource;
  }
  return appendAccessToken(resource, token);
}

/** Inject session token into HLS segment/init URIs returned by calluspirates. */
export function appendAccessTokenToTranscodePlaylist(
  body: string,
  token: string,
): string {
  return body
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      const mapDouble = trimmed.match(/^#EXT-X-MAP:URI="([^"]+)"/);
      if (mapDouble?.[1]) {
        return line.replace(
          mapDouble[1],
          appendTokenToPlaylistResource(mapDouble[1], token),
        );
      }
      const mapSingle = trimmed.match(/^#EXT-X-MAP:URI='([^']+)'/);
      if (mapSingle?.[1]) {
        return line.replace(
          mapSingle[1],
          appendTokenToPlaylistResource(mapSingle[1], token),
        );
      }
      if (
        trimmed.startsWith("/") &&
        isCalluspiratesTranscodeResourceUrl(trimmed)
      ) {
        return appendTokenToPlaylistResource(trimmed, token);
      }
      return line;
    })
    .join("\n");
}

export function mergeTranscodeHlsAuthConfig(
  playlistUrl: string,
  baseConfig: Partial<HlsConfig>,
): Partial<HlsConfig> {
  const token = readAccessTokenFromUrl(playlistUrl);
  if (!token || !isDirectTranscodeHlsUrl(playlistUrl)) {
    return baseConfig;
  }

  return {
    ...baseConfig,
    fetchSetup: (context, initParams) => {
      const url = isCalluspiratesTranscodeResourceUrl(context.url)
        ? appendAccessToken(context.url, token)
        : context.url;
      return new Request(url, initParams);
    },
  };
}
