import type { ScrapePlaybackRefresh } from "./playback-refresh";
import { resolveHlsPlaylistUrl } from "./hls-url";
import { looksLikeHlsStreamUrl } from "./stream-url-patterns";
import { normalizeVidKingAssetHost } from "./vidking-cdn-url";

const MAX_ENCODED_URL_LENGTH = 8192;

export type ScrapePlaybackToken = {
  url: string;
  referer?: string;
  refresh?: ScrapePlaybackRefresh;
  cookies?: string;
  subtitleFormat?: "ass";
};

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
  /\.(?:html|htm|jpg|jpeg|js|css|txt|png|webp|ico|pict)(?:[?#].*)?$/i;

const MPEG_TS_CONTENT_TYPE = "video/mp2t";

const suffixForUrl = (
  url: string,
  subtitleFormat?: ScrapePlaybackToken["subtitleFormat"],
) => {
  if (subtitleFormat === "ass") {
    return "captions.vtt";
  }

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

  if (/\.ass(?:[?#].*)?$/i.test(url)) {
    return "captions.vtt";
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

  if (/\.ass(?:[?#].*)?$/i.test(upstreamUrl)) {
    return "text/vtt";
  }

  if (/\.mp4(?:[?#].*)?$/i.test(upstreamUrl)) {
    return "video/mp4";
  }

  return upstreamContentType ?? undefined;
};

const assTimestampToVtt = (timestamp: string): string | null => {
  const match = timestamp.trim().match(/^(\d+):(\d{2}):(\d{2})[.](\d{2})$/);
  if (!match) return null;
  const [, hours, minutes, seconds, centiseconds] = match;
  return `${hours?.padStart(2, "0")}:${minutes}:${seconds}.${centiseconds}0`;
};

export const convertAssToVtt = (ass: string): string => {
  const cues = ass.split(/\r?\n/).flatMap((line) => {
    if (!line.startsWith("Dialogue:")) return [];
    const fields = line.slice("Dialogue:".length).split(",");
    if (fields.length < 10) return [];
    const start = assTimestampToVtt(fields[1] ?? "");
    const end = assTimestampToVtt(fields[2] ?? "");
    if (!start || !end) return [];
    const text = fields
      .slice(9)
      .join(",")
      .replace(/\{[^}]*\}/g, "")
      .replace(/\\[Nn]/g, "\n")
      .replace(/\\h/g, " ")
      .trim();
    return text ? [`${start} --> ${end}\n${text}`] : [];
  });
  return `WEBVTT\n\n${cues.join("\n\n")}\n`;
};

const KAA_SEGMENT_HOST_PATTERN =
  /^(?:bl1|st1)\.(?:advancedairesearchlab|habibikun|babybayw|narutokun)\.xyz$/i;

const KAA_SEGMENT_ROTATION_HOSTS = [
  "bl1.advancedairesearchlab.xyz",
  "st1.advancedairesearchlab.xyz",
  "bl1.habibikun.xyz",
  "st1.habibikun.xyz",
  "bl1.babybayw.xyz",
  "st1.babybayw.xyz",
  "bl1.narutokun.xyz",
  "st1.narutokun.xyz",
] as const;

/** @deprecated Prefer resolveKaaSegmentFallbackUrls — kept for single-host callers. */
export const resolveKaaSegmentFallbackUrl = (upstreamUrl: string) =>
  resolveKaaSegmentFallbackUrls(upstreamUrl)[0] ?? null;

/**
 * KAA rotates disguised .jpg segment hosts; Cloudflare often blocks one host at a time.
 * Return alternate hosts for the same path so playback/validation can rotate.
 */
export const resolveKaaSegmentFallbackUrls = (
  upstreamUrl: string,
): string[] => {
  try {
    const url = new URL(upstreamUrl);
    if (url.protocol !== "https:") {
      return [];
    }

    if (!KAA_SEGMENT_HOST_PATTERN.test(url.hostname)) {
      return [];
    }

    return KAA_SEGMENT_ROTATION_HOSTS.filter(
      (host) => host !== url.hostname.toLowerCase(),
    ).map((host) => {
      const next = new URL(url.toString());
      next.hostname = host;
      return next.toString();
    });
  } catch {
    return [];
  }
};

export const buildScrapePlayUrl = (payload: ScrapePlaybackToken) =>
  `/api/scrape/play/${encodeScrapePlaybackToken(payload)}/${suffixForUrl(
    payload.url,
    payload.subtitleFormat,
  )}`;

const absolutizePlayUrl = (playUrl: string, baseUrl: string | undefined) => {
  if (!baseUrl) {
    return playUrl;
  }

  try {
    return new URL(playUrl, baseUrl).toString();
  } catch {
    return playUrl;
  }
};

const PLAY_URL_PATTERN = /^\/api\/scrape\/play\/([^/]+)\//;

export const extractScrapePlaybackTokenFromPlayUrl = (
  playUrl: string,
): string | null => {
  const match = playUrl.match(PLAY_URL_PATTERN);
  return match?.[1] ?? null;
};

export const extractScrapePlaybackRefreshFromPlayUrl = (
  playUrl: string,
): ScrapePlaybackRefresh | undefined => {
  const token = extractScrapePlaybackTokenFromPlayUrl(playUrl);
  if (!token) {
    return undefined;
  }

  return decodeScrapePlaybackToken(token)?.refresh;
};

const resolvePlaylistLine = (line: string, manifestUrl: string) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  return resolveHlsPlaylistUrl(trimmed, manifestUrl);
};

const HLS_URI_ATTRIBUTE_PATTERN = /\bURI=("([^"]+)"|'([^']+)')/gi;

const rewritePlaylistUriAttributes = (
  line: string,
  manifestUrl: string,
  referer?: string,
  refresh?: ScrapePlaybackRefresh,
  proxyBaseUrl?: string,
) =>
  line.replace(
    HLS_URI_ATTRIBUTE_PATTERN,
    (
      match,
      quotedValue: string,
      doubleQuoted: string,
      singleQuoted: string,
    ) => {
      const raw = doubleQuoted ?? singleQuoted;
      if (!raw || raw.startsWith("/api/scrape/play/")) {
        return match;
      }

      try {
        const rawResolved =
          resolveHlsPlaylistUrl(raw, manifestUrl) ??
          new URL(raw, manifestUrl).toString();
        const resolved =
          refresh?.providerId === "vidking"
            ? normalizeVidKingAssetHost(rawResolved, manifestUrl)
            : rawResolved;
        const proxied = absolutizePlayUrl(
          buildScrapePlayUrl({
            url: resolved,
            referer,
            refresh,
          }),
          proxyBaseUrl,
        );
        const quote = quotedValue[0] ?? '"';
        return `URI=${quote}${proxied}${quote}`;
      } catch {
        return match;
      }
    },
  );

export const rewriteManifestPlaylist = (
  content: string,
  manifestUrl: string,
  referer?: string,
  refresh?: ScrapePlaybackRefresh,
  proxyBaseUrl?: string,
) =>
  content
    .split(/\r?\n/)
    .map((line) => {
      if (line.trimStart().startsWith("#")) {
        return rewritePlaylistUriAttributes(
          line,
          manifestUrl,
          referer,
          refresh,
          proxyBaseUrl,
        );
      }

      const rawResolved = resolvePlaylistLine(line, manifestUrl);
      const resolved =
        rawResolved && refresh?.providerId === "vidking"
          ? normalizeVidKingAssetHost(rawResolved, manifestUrl)
          : rawResolved;
      if (!resolved) {
        return line;
      }

      return absolutizePlayUrl(
        buildScrapePlayUrl({ url: resolved, referer, refresh }),
        proxyBaseUrl,
      );
    })
    .join("\n");

export { scrapeUpstreamHeaders } from "./upstream-headers";

const isPlaylistResponse = (targetUrl: string, contentType: string | null) => {
  if (isDisguisedHlsSegment(targetUrl)) {
    return false;
  }

  return (
    /\.m3u8(?:[?#].*)?$/i.test(targetUrl) ||
    /cf-master[^/?#]+\.txt(?:[?#].*)?$/i.test(targetUrl) ||
    looksLikeHlsStreamUrl(targetUrl) ||
    (contentType?.includes("mpegurl") ?? false) ||
    (contentType?.includes("m3u8") ?? false)
  );
};

/** Ambiguous CT where extensionless masters often arrive (must body-sniff). */
const isAmbiguousPlaylistContentType = (contentType: string | null) =>
  /(?:text\/|json|octet-stream|binary)/i.test(contentType ?? "");

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
const DASH_TEMPLATE_PATTERN = /\$[^$]+\$/g;
const DASH_TEMPLATE_QUERY_PREFIX = "dash-template-";
const SAFE_DASH_TEMPLATE_VALUE = /^[A-Za-z0-9._~-]{1,128}$/;

const appendDashTemplateParameters = (playUrl: string, templateUrl: string) => {
  const variables = templateUrl.match(DASH_TEMPLATE_PATTERN);
  if (!variables?.length) {
    return playUrl;
  }

  // Keep `$Number%08d$` literal so dash.js / Shaka can substitute before fetch.
  // Do not encodeURIComponent — that hides the markers from the player.
  const query = variables
    .map(
      (variable, index) => `${DASH_TEMPLATE_QUERY_PREFIX}${index}=${variable}`,
    )
    .join("&");

  return `${playUrl}?${query}`;
};

export const resolveDashTemplateUrl = (
  templateUrl: string,
  requestUrl: string,
) => {
  const request = new URL(requestUrl);
  let index = 0;

  return templateUrl.replace(DASH_TEMPLATE_PATTERN, (variable) => {
    const value = request.searchParams.get(
      `${DASH_TEMPLATE_QUERY_PREFIX}${index++}`,
    );
    return value && SAFE_DASH_TEMPLATE_VALUE.test(value) ? value : variable;
  });
};

const proxyDashManifestUrl = (
  raw: string,
  manifestUrl: string,
  referer?: string,
  refresh?: ScrapePlaybackRefresh,
  proxyBaseUrl?: string,
) => {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith("/api/scrape/play/")) {
    return trimmed;
  }

  try {
    const resolved = new URL(trimmed, manifestUrl).toString();
    const playUrl = absolutizePlayUrl(
      buildScrapePlayUrl({ url: resolved, referer, refresh }),
      proxyBaseUrl,
    );
    return appendDashTemplateParameters(playUrl, resolved);
  } catch {
    return trimmed;
  }
};

export const rewriteDashManifest = (
  content: string,
  manifestUrl: string,
  referer?: string,
  refresh?: ScrapePlaybackRefresh,
  proxyBaseUrl?: string,
) => {
  const withAttributes = content.replace(
    DASH_URL_ATTRIBUTE_PATTERN,
    (match, attribute, value) =>
      `${attribute}="${proxyDashManifestUrl(value, manifestUrl, referer, refresh, proxyBaseUrl)}"`,
  );

  return withAttributes.replace(DASH_BASE_URL_PATTERN, (match, value) =>
    match.replace(
      value,
      proxyDashManifestUrl(value, manifestUrl, referer, refresh, proxyBaseUrl),
    ),
  );
};

export {
  isAmbiguousPlaylistContentType,
  isDashManifestResponse,
  isPlaylistResponse,
};
export type { ScrapePlaybackRefresh } from "./playback-refresh";
export type { VidKingPlaybackRefresh } from "./vidking-constants";
export type { VidsrcPlaybackRefresh } from "./vidsrc-constants";
export type { VixsrcPlaybackRefresh } from "./vixsrc-constants";
export type { MegaplayPlaybackRefresh } from "./megaplay-constants";
