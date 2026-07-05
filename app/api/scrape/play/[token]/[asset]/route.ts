import { NextResponse } from "next/server";

import {
  contentTypeForProxiedAsset,
  decodeScrapePlaybackToken,
  isDashManifestResponse,
  isPlaylistResponse,
  rewriteDashManifest,
  rewriteManifestPlaylist,
  scrapeUpstreamHeaders,
} from "@/lib/scrape/playback";
import {
  invalidateVidKingSession,
  isRetryableVidKingUpstreamStatus,
  resolveScrapePlaybackUpstreamUrl,
} from "@/lib/scrape/vidking-playback";

export const maxDuration = 60;

const FETCH_TIMEOUT_MS = 30_000;

type RouteContext = {
  params: Promise<{
    token: string;
    asset: string;
  }>;
};

const fetchUpstream = async (
  upstreamUrl: string,
  referer: string | undefined,
  rangeHeader: string | null,
  signal: AbortSignal,
) =>
  fetch(upstreamUrl, {
    cache: "no-store",
    headers: scrapeUpstreamHeaders(upstreamUrl, referer, rangeHeader),
    redirect: "follow",
    signal,
  });

export async function GET(request: Request, context: RouteContext) {
  const { token } = await context.params;
  const playback = decodeScrapePlaybackToken(token);

  if (!playback) {
    return NextResponse.json(
      { error: "Invalid playback token" },
      { status: 400 },
    );
  }

  const rangeHeader = request.headers.get("range");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    let upstreamUrl = await resolveScrapePlaybackUpstreamUrl(
      playback.url,
      playback.refresh,
    );

    let upstream = await fetchUpstream(
      upstreamUrl,
      playback.referer,
      rangeHeader,
      controller.signal,
    );

    if (
      !upstream.ok &&
      playback.refresh?.providerId === "vidking" &&
      isRetryableVidKingUpstreamStatus(upstream.status)
    ) {
      invalidateVidKingSession(playback.refresh);
      upstreamUrl = await resolveScrapePlaybackUpstreamUrl(
        playback.url,
        playback.refresh,
        { force: true },
      );
      upstream = await fetchUpstream(
        upstreamUrl,
        playback.referer,
        rangeHeader,
        controller.signal,
      );
    }

    if (!upstream.ok) {
      return new NextResponse(null, { status: upstream.status });
    }

    const upstreamContentType = upstream.headers.get("content-type");

    if (isPlaylistResponse(upstreamUrl, upstreamContentType)) {
      const playlist = await upstream.text();
      const rewritten = rewriteManifestPlaylist(
        playlist,
        upstreamUrl,
        playback.referer,
        playback.refresh,
      );

      return new NextResponse(rewritten, {
        status: upstream.status,
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Cache-Control": "no-store",
        },
      });
    }

    if (isDashManifestResponse(upstreamUrl, upstreamContentType)) {
      const manifest = await upstream.text();
      const rewritten = rewriteDashManifest(
        manifest,
        upstreamUrl,
        playback.referer,
        playback.refresh,
      );

      return new NextResponse(rewritten, {
        status: upstream.status,
        headers: {
          "Content-Type": "application/dash+xml",
          "Cache-Control": "no-store",
        },
      });
    }

    const headers = new Headers();
    const passthrough = [
      "content-length",
      "content-range",
      "accept-ranges",
    ] as const;

    for (const key of passthrough) {
      const value = upstream.headers.get(key);
      if (value) {
        headers.set(key, value);
      }
    }

    const contentType = contentTypeForProxiedAsset(
      upstreamUrl,
      upstream.headers.get("content-type"),
    );
    if (contentType) {
      headers.set("Content-Type", contentType);
    }

    headers.set("Cache-Control", "no-store");

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    console.error("Scrape playback proxy failed:", error);
    return NextResponse.json(
      { error: "Failed to proxy scraped stream" },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
