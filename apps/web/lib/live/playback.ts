import {
  getOpenStreamPlaybackConfig,
  isAllowedOpenStreamHost,
  isAllowedOpenStreamUrl,
} from "@/lib/live/open-stream-registry";

export const DULO_REFERER = "https://dulo.tv/";
const DEFAULT_OPEN_STREAM_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const DULO_STREAM_HOSTS = new Set([
  "images.dulo.tv",
  "hey.dulo.tv",
  "bridge.dulo.tv",
]);

const MAX_ENCODED_URL_LENGTH = 4096;

export const isAllowedDuloStreamUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    const isAllowedPath = /^\/memfs\/.+\.(?:m3u8|ts)$/i.test(parsed.pathname);

    return (
      parsed.protocol === "https:" &&
      DULO_STREAM_HOSTS.has(parsed.hostname) &&
      isAllowedPath
    );
  } catch {
    return false;
  }
};

export const isAllowedLiveStreamUrl = (value: string) =>
  isAllowedDuloStreamUrl(value) || isAllowedOpenStreamUrl(value);

export const encodeLiveStreamUrl = (url: string) =>
  Buffer.from(url, "utf8").toString("base64url");

export const decodeLiveStreamToken = (token: string) => {
  if (!token || token.length > MAX_ENCODED_URL_LENGTH) {
    return null;
  }

  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    return isAllowedLiveStreamUrl(decoded) ? decoded : null;
  } catch {
    return null;
  }
};

const suffixForUrl = (url: string) => {
  if (/\.m3u8(?:[?#].*)?$/i.test(url)) {
    return "asset.m3u8";
  }

  if (/\.ts(?:[?#].*)?$/i.test(url)) {
    return "segment.ts";
  }

  return "asset";
};

export const buildLivePlayUrl = (upstreamUrl: string) =>
  `/api/live/play/${encodeLiveStreamUrl(upstreamUrl)}/${suffixForUrl(upstreamUrl)}`;

const resolvePlaylistLine = (line: string, manifestUrl: string) => {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  try {
    return new URL(trimmed, manifestUrl).toString();
  } catch {
    return null;
  }
};

export const rewriteLivePlaylist = (content: string, manifestUrl: string) =>
  content
    .split(/\r?\n/)
    .map((line) => {
      const resolved = resolvePlaylistLine(line, manifestUrl);

      if (!resolved || !isAllowedLiveStreamUrl(resolved)) {
        return line;
      }

      return buildLivePlayUrl(resolved);
    })
    .join("\n");

export const liveUpstreamHeaders = (
  upstreamUrl: string,
  rangeHeader: string | null,
) => {
  const openConfig = getOpenStreamPlaybackConfig(upstreamUrl);
  const headers: Record<string, string> = {};

  if (openConfig) {
    headers["User-Agent"] =
      openConfig.userAgent ?? DEFAULT_OPEN_STREAM_USER_AGENT;

    if (openConfig.referer) {
      headers.Referer = openConfig.referer;
    }
  } else {
    try {
      const hostname = new URL(upstreamUrl).hostname;

      if (isAllowedOpenStreamHost(hostname)) {
        headers["User-Agent"] = DEFAULT_OPEN_STREAM_USER_AGENT;
      } else {
        headers.Referer = DULO_REFERER;
      }
    } catch {
      headers.Referer = DULO_REFERER;
    }
  }

  if (rangeHeader) {
    headers.Range = rangeHeader;
  }

  return headers;
};
