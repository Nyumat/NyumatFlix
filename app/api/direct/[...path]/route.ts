import { NextResponse } from "next/server";

import { fetchCalluspirates } from "@/lib/scrape/calluspirates-fetch";
import {
  inferDirectMediaContentType,
  isDirectMediaProxyPath,
  isDirectPlaylistContentType,
  resolveCalluspiratesProxyTarget,
  rewriteDirectProxyPlaylist,
  shouldRewriteDirectProxyPlaylist,
} from "@/lib/scrape/direct-proxy";

export const maxDuration = 300;

type RouteContext = {
  params: Promise<{
    path: string[];
  }>;
};

const PASS_RESPONSE_HEADERS = [
  "content-range",
  "accept-ranges",
  "etag",
  "last-modified",
  "x-content-duration",
  "cache-control",
] as const;

const PASS_REQUEST_HEADERS = ["range", "accept", "user-agent"] as const;

function shapeDirectProxyHeaders(
  upstream: Response,
  requestUrl: string,
  options?: { rewrittenPlaylist?: boolean },
): Headers {
  const outHeaders = new Headers();
  for (const key of PASS_RESPONSE_HEADERS) {
    const value = upstream.headers.get(key);
    if (value) {
      outHeaders.set(key, value);
    }
  }

  if (!options?.rewrittenPlaylist) {
    const contentLength = upstream.headers.get("content-length");
    if (contentLength) {
      outHeaders.set("Content-Length", contentLength);
    }
  }

  if (!outHeaders.has("accept-ranges")) {
    outHeaders.set("Accept-Ranges", "bytes");
  }

  const contentType = inferDirectMediaContentType(
    upstream.headers.get("content-type"),
    requestUrl,
    {
      contentDisposition: upstream.headers.get("content-disposition"),
      finalUrl: upstream.url,
    },
  );
  if (contentType) {
    outHeaders.set("Content-Type", contentType);
  } else {
    const upstreamType = upstream.headers.get("content-type");
    if (upstreamType) {
      outHeaders.set("Content-Type", upstreamType);
    }
  }

  const incoming = new URL(requestUrl);
  if (isDirectMediaProxyPath(incoming.pathname)) {
    outHeaders.set("Content-Disposition", "inline");
    outHeaders.set("Cache-Control", "private, max-age=300");
  }

  outHeaders.set(
    "Access-Control-Expose-Headers",
    "Content-Length, Content-Range, Accept-Ranges, Content-Type",
  );

  return outHeaders;
}

function buildUpstreamHeaders(request: Request): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const key of PASS_REQUEST_HEADERS) {
    const value = request.headers.get(key);
    if (value) {
      headers[key] = value;
    }
  }
  if (!headers.accept) {
    headers.accept = "*/*";
  }
  return headers;
}

async function probeCalluspiratesMedia(
  target: string,
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<Response> {
  const head = await fetchCalluspirates(target, {
    method: "HEAD",
    headers,
    responseKind: "binary",
    timeoutMs: 300_000,
    signal,
  });
  if (head.ok || head.status === 206) {
    return head;
  }

  return fetchCalluspirates(target, {
    method: "GET",
    headers: { ...headers, Range: "bytes=0-0" },
    responseKind: "binary",
    timeoutMs: 300_000,
    signal,
  });
}

async function proxyDirectPlayback(request: Request): Promise<Response> {
  const target = resolveCalluspiratesProxyTarget(request.url);
  if (!target) {
    return NextResponse.json(
      { error: "Direct proxy is not configured" },
      { status: 503 },
    );
  }

  const headers = buildUpstreamHeaders(request);

  let upstream: Response;
  try {
    upstream =
      request.method === "HEAD"
        ? await probeCalluspiratesMedia(target, headers, request.signal)
        : await fetchCalluspirates(target, {
            method: "GET",
            headers,
            responseKind: "binary",
            timeoutMs: 300_000,
            signal: request.signal,
          });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Upstream fetch failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  if (!upstream.ok && upstream.status !== 206) {
    const detail = await upstream.text().catch(() => "");
    return new NextResponse(detail || `Upstream ${upstream.status}`, {
      status: upstream.status,
    });
  }

  const outHeaders = shapeDirectProxyHeaders(upstream, request.url);

  if (request.method === "HEAD") {
    return new NextResponse(null, {
      status: upstream.status === 206 ? 200 : upstream.status,
      headers: outHeaders,
    });
  }

  const incoming = new URL(request.url);
  const contentType = outHeaders.get("content-type") ?? "";
  const shouldRewrite =
    shouldRewriteDirectProxyPlaylist(incoming.pathname) ||
    isDirectPlaylistContentType(contentType);

  if (shouldRewrite) {
    const playlist = await upstream.text();
    const accessToken = incoming.searchParams.get("access_token") ?? undefined;
    const rewritten = rewriteDirectProxyPlaylist(playlist, accessToken);
    const playlistHeaders = shapeDirectProxyHeaders(upstream, request.url, {
      rewrittenPlaylist: true,
    });
    playlistHeaders.delete("Content-Length");
    return new NextResponse(rewritten, {
      status: upstream.status,
      headers: playlistHeaders,
    });
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: outHeaders,
  });
}

export async function GET(request: Request, _context: RouteContext) {
  return proxyDirectPlayback(request);
}

export async function HEAD(request: Request, _context: RouteContext) {
  return proxyDirectPlayback(request);
}
