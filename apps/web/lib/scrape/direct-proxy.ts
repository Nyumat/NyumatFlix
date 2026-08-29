import { getCalluspiratesApiUrl } from "@/lib/scrape/calluspirates-config";

/**
 * Legacy same-origin prefix. Playback now hits calluspirates directly;
 * we still recognize these paths so cached/scrape URLs can be unwrapped.
 */
export const DIRECT_PROXY_PREFIX = "/api/direct";

export function isCalluspiratesPlaybackPath(pathname: string): boolean {
  return (
    pathname === "/api/media" ||
    pathname.startsWith("/api/media/") ||
    pathname.startsWith("/api/transcode/")
  );
}

export function unwrapDirectProxyPath(pathOrUrl: string): string {
  if (pathOrUrl.startsWith(`${DIRECT_PROXY_PREFIX}/`)) {
    return `/api${pathOrUrl.slice(DIRECT_PROXY_PREFIX.length)}`;
  }
  try {
    const parsed = new URL(pathOrUrl);
    if (parsed.pathname.startsWith(`${DIRECT_PROXY_PREFIX}/`)) {
      return `/api${parsed.pathname.slice(DIRECT_PROXY_PREFIX.length)}${parsed.search}`;
    }
  } catch {
    // not an absolute URL
  }
  return pathOrUrl;
}

export function appendAccessToken(url: string, token: string): string {
  const parsed = new URL(url, "http://local.invalid");
  parsed.searchParams.set("access_token", token);
  if (/^https?:\/\//i.test(url)) {
    return parsed.toString();
  }
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

function absoluteCalluspiratesUrl(apiBase: string, path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  return `${apiBase}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Server-side probes and upstream fetches — talk to calluspirates directly. */
export function toUpstreamCalluspiratesPlaybackUrl(
  apiBase: string,
  pathOrUrl: string,
): string {
  return absoluteCalluspiratesUrl(apiBase, unwrapDirectProxyPath(pathOrUrl));
}

/** Client playback URLs — calluspirates origin, with a short-lived access token. */
export function toClientDirectPlaybackUrl(
  apiBase: string,
  pathOrUrl: string,
  accessToken?: string,
): string {
  const unwrapped = unwrapDirectProxyPath(pathOrUrl);
  const absolute = absoluteCalluspiratesUrl(apiBase, unwrapped);
  if (!accessToken) {
    return absolute;
  }
  return appendAccessToken(absolute, accessToken);
}

export function isClientDirectPlaybackUrl(playUrl: string): boolean {
  if (playUrl.startsWith(`${DIRECT_PROXY_PREFIX}/`)) {
    return true;
  }
  if (
    playUrl.startsWith("/api/media") ||
    playUrl.startsWith("/api/transcode")
  ) {
    return true;
  }
  try {
    const parsed = new URL(playUrl);
    return (
      isCalluspiratesPlaybackPath(parsed.pathname) ||
      parsed.pathname.startsWith(`${DIRECT_PROXY_PREFIX}/`)
    );
  } catch {
    return false;
  }
}

import { appendAccessTokenToTranscodePlaylist } from "@/lib/direct/transcode-hls-auth";

/** Rewrite calluspirates-relative HLS paths for same-origin NyumatFlix proxy. */
export function rewriteDirectProxyPlaylist(
  body: string,
  accessToken?: string,
): string {
  let rewritten = body
    .replaceAll("/api/transcode/", `${DIRECT_PROXY_PREFIX}/transcode/`)
    .replaceAll("/api/media?", `${DIRECT_PROXY_PREFIX}/media?`)
    .replaceAll('URI="/api/media?', `URI="${DIRECT_PROXY_PREFIX}/media?`)
    .replaceAll("URI='/api/media?", `URI='${DIRECT_PROXY_PREFIX}/media?`);

  if (accessToken) {
    rewritten = appendAccessTokenToTranscodePlaylist(rewritten, accessToken);
  }

  return rewritten;
}

export function shouldRewriteDirectProxyPlaylist(pathname: string): boolean {
  return pathname.includes("/transcode/playlist") || pathname.endsWith(".m3u8");
}

export function isDirectPlaylistContentType(contentType: string): boolean {
  const normalized = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  return (
    normalized.includes("mpegurl") ||
    normalized === "application/vnd.apple.mpegurl" ||
    normalized === "audio/mpegurl" ||
    normalized === "application/x-mpegurl"
  );
}

export function resolveCalluspiratesProxyTarget(
  requestUrl: string,
): string | null {
  const apiBase = getCalluspiratesApiUrl();
  if (!apiBase) {
    return null;
  }

  const incoming = new URL(requestUrl);
  if (!incoming.pathname.startsWith(`${DIRECT_PROXY_PREFIX}/`)) {
    return null;
  }

  const upstreamPath = `/api${incoming.pathname.slice(DIRECT_PROXY_PREFIX.length)}`;
  return `${apiBase.replace(/\/$/, "")}${upstreamPath}${incoming.search}`;
}

/** Match calluspirates media.ts — TorBox often sends octet-stream / attachment. */
export function inferDirectMediaContentType(
  upstreamType: string | null,
  targetUrl: string,
  options?: {
    contentDisposition?: string | null;
    finalUrl?: string | null;
  },
): string | null {
  const disposition = options?.contentDisposition ?? "";
  const filenameMatch = disposition.match(
    /filename\*?=(?:UTF-8''|")?([^";]+)/i,
  );
  const dispositionPath = filenameMatch?.[1]
    ? decodeURIComponent(filenameMatch[1].replace(/"/g, ""))
    : "";

  let pathname = "";
  try {
    const parsed = new URL(targetUrl);
    const nested = parsed.searchParams.get("u");
    if (nested) {
      try {
        pathname = new URL(nested).pathname;
      } catch {
        pathname = nested;
      }
    } else {
      pathname = parsed.pathname;
    }
  } catch {
    pathname = targetUrl;
  }

  if (options?.finalUrl) {
    try {
      pathname = new URL(options.finalUrl).pathname;
    } catch {
      // keep nested pathname
    }
  }

  const rawPath = pathname.toLowerCase();
  const decoded = (() => {
    try {
      return decodeURIComponent(rawPath);
    } catch {
      return rawPath;
    }
  })();

  const inferFromPath = (path: string): string | null => {
    if (/\.mkv(?:[?#]|$)/.test(path)) return "video/x-matroska";
    if (/\.mp4(?:[?#]|$)/.test(path)) return "video/mp4";
    if (/\.m4v(?:[?#]|$)/.test(path)) return "video/mp4";
    if (/\.webm(?:[?#]|$)/.test(path)) return "video/webm";
    if (/\.m3u8(?:[?#]|$)/.test(path)) return "application/vnd.apple.mpegurl";
    if (/\.avi(?:[?#]|$)/.test(path)) return "video/x-msvideo";
    return null;
  };

  const fromPath =
    inferFromPath(rawPath) ??
    inferFromPath(decoded) ??
    (dispositionPath ? inferFromPath(dispositionPath.toLowerCase()) : null);
  if (fromPath) {
    return fromPath;
  }

  const normalized = upstreamType?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (
    !normalized ||
    normalized === "application/octet-stream" ||
    normalized === "application/force-download" ||
    normalized === "binary/octet-stream"
  ) {
    return null;
  }

  return upstreamType;
}

export function isDirectMediaProxyPath(pathname: string): boolean {
  return (
    pathname === `${DIRECT_PROXY_PREFIX}/media` ||
    pathname.startsWith(`${DIRECT_PROXY_PREFIX}/media?`)
  );
}
