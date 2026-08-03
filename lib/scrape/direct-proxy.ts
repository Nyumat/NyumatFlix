import { getCalluspiratesApiUrl } from "@/lib/scrape/calluspirates-config";

/**
 * Same-origin prefix for calluspirates playback on NyumatFlix.
 * Mirrors calluspirates Vite `/api` proxy and nginx `/api/` in production.
 */
export const DIRECT_PROXY_PREFIX = "/api/direct";

export function isCalluspiratesPlaybackPath(pathname: string): boolean {
  return pathname === "/api/media" || pathname.startsWith("/api/transcode/");
}

/** Same-origin Nyumat proxy paths — safe in the browser (SSE chunks, client rewrite). */
export function rewritePlaybackUrlForBrowser(pathOrUrl: string): string {
  if (pathOrUrl.startsWith(`${DIRECT_PROXY_PREFIX}/`)) {
    return pathOrUrl;
  }
  if (pathOrUrl.startsWith("/api/media")) {
    return `${DIRECT_PROXY_PREFIX}/media${pathOrUrl.slice("/api/media".length)}`;
  }
  if (pathOrUrl.startsWith("/api/transcode")) {
    return `${DIRECT_PROXY_PREFIX}/transcode${pathOrUrl.slice("/api/transcode".length)}`;
  }
  try {
    const parsed = new URL(pathOrUrl);
    if (isCalluspiratesPlaybackPath(parsed.pathname)) {
      return `${DIRECT_PROXY_PREFIX}${parsed.pathname.slice("/api".length)}${parsed.search}`;
    }
  } catch {
    // not an absolute URL
  }
  return pathOrUrl;
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
  return absoluteCalluspiratesUrl(apiBase, pathOrUrl);
}

/**
 * Client-facing playback URLs — always same-origin on NyumatFlix so Movi/Vidstack
 * behave like calluspirates (Vite proxy / nginx), regardless of CORS.
 */
export function toClientDirectPlaybackUrl(
  apiBase: string,
  pathOrUrl: string,
): string {
  const absolute = absoluteCalluspiratesUrl(apiBase, pathOrUrl);
  try {
    const parsed = new URL(absolute);
    const base = new URL(apiBase);
    if (
      parsed.origin === base.origin &&
      isCalluspiratesPlaybackPath(parsed.pathname)
    ) {
      return rewritePlaybackUrlForBrowser(`${parsed.pathname}${parsed.search}`);
    }
  } catch {
    // fall through
  }
  return absolute;
}

export function isClientDirectPlaybackUrl(playUrl: string): boolean {
  if (playUrl.startsWith(`${DIRECT_PROXY_PREFIX}/`)) {
    return true;
  }
  return (
    !playUrl.startsWith("http://") &&
    !playUrl.startsWith("https://") &&
    playUrl.startsWith("/api/media")
  );
}

/** Rewrite calluspirates-relative HLS paths for same-origin NyumatFlix proxy. */
export function rewriteDirectProxyPlaylist(body: string): string {
  return body
    .replaceAll("/api/transcode/", `${DIRECT_PROXY_PREFIX}/transcode/`)
    .replaceAll("/api/media?", `${DIRECT_PROXY_PREFIX}/media?`)
    .replaceAll('URI="/api/media?', `URI="${DIRECT_PROXY_PREFIX}/media?`)
    .replaceAll("URI='/api/media?", `URI='${DIRECT_PROXY_PREFIX}/media?`);
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
): string | null {
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
    return null;
  };

  const fromPath = inferFromPath(rawPath) ?? inferFromPath(decoded);
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
    return fromPath;
  }

  return upstreamType;
}

export function isDirectMediaProxyPath(pathname: string): boolean {
  return (
    pathname === `${DIRECT_PROXY_PREFIX}/media` ||
    pathname.startsWith(`${DIRECT_PROXY_PREFIX}/media?`)
  );
}
