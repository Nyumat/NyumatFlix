import type { VidKingPlaybackRefresh } from "./vidking-constants";

const MAX_ENCODED_URL_LENGTH = 8192;

export type ScrapePlaybackToken = {
  url: string;
  referer?: string;
  refresh?: VidKingPlaybackRefresh;
};

// Browser Buffer polyfills support "base64" but not Node's "base64url".
const encodeBase64Url = (value: string) =>
  Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const decodeBase64Url = (token: string) => {
  const base64 = token.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (base64.length % 4)) % 4;
  return Buffer.from(`${base64}${"=".repeat(padLength)}`, "base64").toString(
    "utf8",
  );
};

export const encodeScrapePlaybackToken = (payload: ScrapePlaybackToken) =>
  encodeBase64Url(JSON.stringify(payload));

export const decodeScrapePlaybackToken = (
  token: string,
): ScrapePlaybackToken | null => {
  if (!token || token.length > MAX_ENCODED_URL_LENGTH) {
    return null;
  }

  try {
    const decoded = JSON.parse(decodeBase64Url(token)) as ScrapePlaybackToken;

    if (!decoded.url || typeof decoded.url !== "string") {
      return null;
    }

    const parsed = new URL(decoded.url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
};

const DISGUISED_HLS_SEGMENT =
  /\.(?:html|htm|jpg|jpeg|js|css|txt|png|webp|ico)(?:[?#].*)?$/i;

const MPEG_TS_CONTENT_TYPE = "video/mp2t";

const suffixForUrl = (url: string) => {
  if (/\.m3u8(?:[?#].*)?$/i.test(url)) {
    return "asset.m3u8";
  }

  if (/\.mpd(?:[?#].*)?$/i.test(url)) {
    return "asset.mpd";
  }

  if (/\.mp4(?:[?#].*)?$/i.test(url)) {
    return "asset.mp4";
  }

  if (/\.ts(?:[?#].*)?$/i.test(url)) {
    return "segment.ts";
  }

  if (DISGUISED_HLS_SEGMENT.test(url)) {
    return "segment.ts";
  }

  if (/\.json(?:[?#].*)?$/i.test(url)) {
    return "asset.json";
  }

  if (/\.vtt(?:[?#].*)?$/i.test(url)) {
    return "captions.vtt";
  }

  if (/\.srt(?:[?#].*)?$/i.test(url)) {
    return "captions.srt";
  }

  if (/cf-master[^/?#]+\.txt(?:[?#].*)?$/i.test(url)) {
    return "asset.txt";
  }

  return "asset";
};

export const isDisguisedHlsSegment = (url: string) =>
  DISGUISED_HLS_SEGMENT.test(url);

export const contentTypeForProxiedAsset = (
  upstreamUrl: string,
  upstreamContentType: string | null,
): string | undefined => {
  if (isDisguisedHlsSegment(upstreamUrl)) {
    return MPEG_TS_CONTENT_TYPE;
  }

  if (/\.vtt(?:[?#].*)?$/i.test(upstreamUrl)) {
    return "text/vtt";
  }

  if (/\.srt(?:[?#].*)?$/i.test(upstreamUrl)) {
    return "application/x-subrip";
  }

  if (/\.mp4(?:[?#].*)?$/i.test(upstreamUrl)) {
    return "video/mp4";
  }

  return upstreamContentType ?? undefined;
};

export const buildScrapePlayUrl = (payload: ScrapePlaybackToken) =>
  `/api/scrape/play/${encodeScrapePlaybackToken(payload)}/${suffixForUrl(payload.url)}`;

const PLAY_URL_PATTERN = /^\/api\/scrape\/play\/([^/]+)\//;

export const extractScrapePlaybackTokenFromPlayUrl = (
  playUrl: string,
): string | null => {
  const match = playUrl.match(PLAY_URL_PATTERN);
  return match?.[1] ?? null;
};

export const extractScrapePlaybackRefreshFromPlayUrl = (
  playUrl: string,
): VidKingPlaybackRefresh | undefined => {
  const token = extractScrapePlaybackTokenFromPlayUrl(playUrl);
  if (!token) {
    return undefined;
  }

  const decoded = decodeScrapePlaybackToken(token);
  return decoded?.refresh?.providerId === "vidking"
    ? decoded.refresh
    : undefined;
};

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

export const rewriteManifestPlaylist = (
  content: string,
  manifestUrl: string,
  referer?: string,
  refresh?: VidKingPlaybackRefresh,
) =>
  content
    .split(/\r?\n/)
    .map((line) => {
      const resolved = resolvePlaylistLine(line, manifestUrl);
      if (!resolved) {
        return line;
      }

      return buildScrapePlayUrl({ url: resolved, referer, refresh });
    })
    .join("\n");

export { scrapeUpstreamHeaders } from "./upstream-headers";

const isPlaylistResponse = (targetUrl: string, contentType: string | null) =>
  /\.m3u8(?:[?#].*)?$/i.test(targetUrl) ||
  /cf-master[^/?#]+\.txt(?:[?#].*)?$/i.test(targetUrl) ||
  (contentType?.includes("mpegurl") ?? false) ||
  (contentType?.includes("m3u8") ?? false);

const isDashManifestResponse = (
  targetUrl: string,
  contentType: string | null,
) =>
  /\.mpd(?:[?#].*)?$/i.test(targetUrl) ||
  (contentType?.includes("dash+xml") ?? false) ||
  (contentType?.includes("application/dash") ?? false);

const DASH_URL_ATTRIBUTE_PATTERN =
  /\b(media|initialization|sourceURL|href)="([^"]+)"/gi;
const DASH_BASE_URL_PATTERN = /<BaseURL[^>]*>([^<]+)<\/BaseURL>/gi;

const proxyDashManifestUrl = (
  raw: string,
  manifestUrl: string,
  referer?: string,
  refresh?: VidKingPlaybackRefresh,
) => {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith("/api/scrape/play/")) {
    return trimmed;
  }

  try {
    const resolved = new URL(trimmed, manifestUrl).toString();
    return buildScrapePlayUrl({ url: resolved, referer, refresh });
  } catch {
    return trimmed;
  }
};

export const rewriteDashManifest = (
  content: string,
  manifestUrl: string,
  referer?: string,
  refresh?: VidKingPlaybackRefresh,
) => {
  const withAttributes = content.replace(
    DASH_URL_ATTRIBUTE_PATTERN,
    (match, attribute, value) =>
      `${attribute}="${proxyDashManifestUrl(value, manifestUrl, referer, refresh)}"`,
  );

  return withAttributes.replace(DASH_BASE_URL_PATTERN, (match, value) =>
    match.replace(
      value,
      proxyDashManifestUrl(value, manifestUrl, referer, refresh),
    ),
  );
};

export { isDashManifestResponse, isPlaylistResponse };
export type { VidKingPlaybackRefresh } from "./vidking-constants";
