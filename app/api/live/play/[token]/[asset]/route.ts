import { NextResponse } from "next/server";

import {
  decodeLiveStreamToken,
  isAllowedLiveStreamUrl,
  liveUpstreamHeaders,
  rewriteLivePlaylist,
} from "@/lib/live/playback";

export const maxDuration = 60;

const FETCH_TIMEOUT_MS = 30_000;

const isPlaylistResponse = (targetUrl: string, contentType: string | null) =>
  /\.m3u8(?:[?#].*)?$/i.test(targetUrl) ||
  (contentType?.includes("mpegurl") ?? false) ||
  (contentType?.includes("m3u8") ?? false);

const fetchUpstream = async (
  upstreamUrl: string,
  rangeHeader: string | null,
) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(upstreamUrl, {
      cache: "no-store",
      headers: liveUpstreamHeaders(rangeHeader),
      redirect: "follow",
      signal: controller.signal,
    });

    if (response.url && !isAllowedLiveStreamUrl(response.url)) {
      throw new Error("Disallowed live stream redirect");
    }

    return response;
  } finally {
    clearTimeout(timeout);
  }
};

type RouteContext = {
  params: Promise<{
    token: string;
    asset: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { token } = await context.params;
  const upstreamUrl = decodeLiveStreamToken(token);

  if (!upstreamUrl) {
    return NextResponse.json({ error: "Invalid live stream" }, { status: 400 });
  }

  try {
    const upstream = await fetchUpstream(
      upstreamUrl,
      request.headers.get("range"),
    );

    if (!upstream.ok) {
      return new NextResponse(null, { status: upstream.status });
    }

    const contentType = upstream.headers.get("content-type");

    if (isPlaylistResponse(upstreamUrl, contentType)) {
      const text = await upstream.text();

      return new NextResponse(rewriteLivePlaylist(text, upstreamUrl), {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "application/vnd.apple.mpegurl",
        },
      });
    }

    const headers = new Headers();
    headers.set("Cache-Control", "no-store");

    if (contentType) {
      headers.set("Content-Type", contentType);
    }

    const contentLength = upstream.headers.get("content-length");
    if (contentLength) {
      headers.set("Content-Length", contentLength);
    }

    const contentRange = upstream.headers.get("content-range");
    if (contentRange) {
      headers.set("Content-Range", contentRange);
    }

    const acceptRanges = upstream.headers.get("accept-ranges");
    if (acceptRanges) {
      headers.set("Accept-Ranges", acceptRanges);
    }

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    console.error("Error proxying live stream:", error);

    return NextResponse.json(
      { error: "Failed to proxy live stream" },
      { status: 502 },
    );
  }
}
