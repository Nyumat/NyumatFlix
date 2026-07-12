import { NextResponse } from "next/server";

import {
  convertAssToVtt,
  contentTypeForProxiedAsset,
  decodeScrapePlaybackToken,
  isAmbiguousPlaylistContentType,
  isDashManifestResponse,
  isDisguisedHlsSegment,
  isPlaylistResponse,
  resolveKaaSegmentFallbackUrls,
  resolveDashTemplateUrl,
  rewriteDashManifest,
  rewriteManifestPlaylist,
} from "@/lib/scrape/playback";
import { fetchScrapePlaybackUpstream } from "@/lib/scrape/playback-fetch";
import { cancelResponseBody } from "@/lib/scrape/fetch";
import {
  invalidateVidKingSession,
  isRetryableVidKingUpstreamStatus,
  resolveScrapePlaybackUpstreamUrl,
} from "@/lib/scrape/vidking-playback";
import { isVidsrcPlaybackRefresh } from "@/lib/scrape/playback-refresh";

export const maxDuration = 60;

type RouteContext = {
  params: Promise<{
    token: string;
    asset: string;
  }>;
};

const fetchUpstream = (
  upstreamUrl: string,
  referer: string | undefined,
  rangeHeader: string | null,
  signal: AbortSignal,
  cookies?: string,
) =>
  fetchScrapePlaybackUpstream(upstreamUrl, referer, {
    rangeHeader,
    cookies,
    signal,
    // Must match validation — curlFallback true for hosts that block undici.
    curlFallback: true,
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

  try {
    const playbackUrl = resolveDashTemplateUrl(playback.url, request.url);
    let upstreamUrl = await resolveScrapePlaybackUpstreamUrl(
      playbackUrl,
      playback.refresh,
    );

    let upstream = await fetchUpstream(
      upstreamUrl,
      playback.referer,
      rangeHeader,
      request.signal,
      playback.cookies,
    );

    if (upstream.status === 403) {
      const fallbackUrls = resolveKaaSegmentFallbackUrls(upstreamUrl);
      for (const fallbackUrl of fallbackUrls) {
        await cancelResponseBody(upstream);
        upstreamUrl = fallbackUrl;
        upstream = await fetchUpstream(
          upstreamUrl,
          playback.referer,
          rangeHeader,
          request.signal,
          playback.cookies,
        );
        if (upstream.ok || upstream.status !== 403) {
          break;
        }
      }
    }

    if (
      !upstream.ok &&
      playback.refresh?.providerId === "vidking" &&
      isRetryableVidKingUpstreamStatus(upstream.status)
    ) {
      await cancelResponseBody(upstream);
      invalidateVidKingSession(playback.refresh);
      upstreamUrl = await resolveScrapePlaybackUpstreamUrl(
        playbackUrl,
        playback.refresh,
        { force: true },
      );
      upstream = await fetchUpstream(
        upstreamUrl,
        playback.referer,
        rangeHeader,
        request.signal,
        playback.cookies,
      );
    }

    if (
      !upstream.ok &&
      isVidsrcPlaybackRefresh(playback.refresh) &&
      upstream.status === 403
    ) {
      await cancelResponseBody(upstream);
      upstreamUrl = await resolveScrapePlaybackUpstreamUrl(
        playbackUrl,
        playback.refresh,
      );
      upstream = await fetchUpstream(
        upstreamUrl,
        playback.referer,
        rangeHeader,
        request.signal,
        playback.cookies,
      );
    }

    if (!upstream.ok) {
      const body = await upstream.text().catch(() => "");
      return new NextResponse(body, { status: upstream.status });
    }

    const upstreamContentType = upstream.headers.get("content-type");

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

    const tryAsPlaylist =
      isPlaylistResponse(upstreamUrl, upstreamContentType) ||
      (!isDisguisedHlsSegment(upstreamUrl) &&
        isAmbiguousPlaylistContentType(upstreamContentType));

    if (tryAsPlaylist) {
      const playlist = await upstream.text();
      const isHls = playlist.includes("#EXTM3U");
      const isDash =
        !isHls && (playlist.includes("<MPD") || /\bmpd\b/i.test(playlist));

      if (isHls || isPlaylistResponse(upstreamUrl, upstreamContentType)) {
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

      if (isDash) {
        const rewritten = rewriteDashManifest(
          playlist,
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

      // Ambiguous CT but not a manifest — return text as-is.
      return new NextResponse(playlist, {
        status: upstream.status,
        headers: {
          ...(upstreamContentType
            ? { "Content-Type": upstreamContentType }
            : {}),
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

    const body =
      playback.subtitleFormat === "ass" ||
      /\.ass(?:[?#].*)?$/i.test(upstreamUrl)
        ? convertAssToVtt(await upstream.text())
        : upstream.body;

    if (typeof body === "string") {
      headers.delete("content-length");
      headers.delete("content-range");
      headers.delete("accept-ranges");
    }

    return new NextResponse(body, {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    if (request.signal.aborted) {
      return new NextResponse(null, { status: 499 });
    }
    console.error("Scrape playback proxy failed:", error);
    return NextResponse.json(
      { error: "Failed to proxy scraped stream" },
      { status: 502 },
    );
  }
}
