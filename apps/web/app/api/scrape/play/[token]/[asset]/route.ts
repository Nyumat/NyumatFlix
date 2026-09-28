import { NextResponse } from "next/server";

import {
  CACHE_CONTROL_PLAY_MEDIA,
  cacheControlForProxiedPlayAsset,
  convertAssToVtt,
  convertSrtToVtt,
  contentTypeForProxiedAsset,
  decodeScrapePlaybackToken,
  isAmbiguousPlaylistContentType,
  isDashManifestResponse,
  isDisguisedHlsSegment,
  isPlaylistResponse,
  isProxiedPlaySrtCaption,
  playUpstreamAbortSignal,
  resolveKaaSegmentFallbackUrls,
  resolveDashTemplateUrl,
  rewriteDashManifest,
  rewriteManifestPlaylist,
} from "@/lib/scrape/playback";
import {
  parseByteRangeHeader,
  sliceStreamToByteRange,
  sniffUpstreamBody,
  type SniffedProxiedBodyKind,
} from "@/lib/scrape/media-sniff";
import { decodeObfuscatedHlsBody } from "@/lib/scrape/hls-body";
import { fetchScrapePlaybackUpstream } from "@/lib/scrape/playback-fetch";
import { cancelResponseBody } from "@/lib/scrape/fetch";
import { isVidKingPlaybackRefresh } from "@/lib/scrape/playback-refresh";
import {
  invalidateVidKingSession,
  isRetryableVidKingUpstreamStatus,
  resolveScrapePlaybackUpstreamUrl,
} from "@/lib/scrape/vidking-playback";
import {
  invalidateVidsrcJwtSession,
  isRetryableVidsrcUpstreamStatus,
} from "@/lib/scrape/vidsrc-playback";
import {
  invalidateVixsrcSession,
  isRetryableVixsrcUpstreamStatus,
} from "@/lib/scrape/vixsrc-playback";
import { isRetryableMegaplayUpstreamStatus } from "@/lib/scrape/megaplay-playback";
import {
  isMegaplayPlaybackRefresh,
  isVidsrcPlaybackRefresh,
  isVixsrcPlaybackRefresh,
} from "@/lib/scrape/playback-refresh";

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
    retryAttempts: 1,
    // Must match validation — curlFallback true for hosts that block undici.
    curlFallback: true,
  });

/**
 * When the upstream ignored the client's Range request (200 full-body),
 * compute the local slice bounds when the total length is known. Without it,
 * a 206 could promise more bytes than the upstream actually sends.
 */
const resolveUpstreamIgnoredRange = (
  upstream: Response,
  rangeHeader: string | null,
): { start: number; end: number; total: string } | null => {
  const requestedRange = parseByteRangeHeader(rangeHeader);
  if (!requestedRange || upstream.status !== 200) {
    return null;
  }
  const lengthHeader = upstream.headers.get("content-length");
  const upstreamLength = lengthHeader === null ? NaN : Number(lengthHeader);
  if (!Number.isSafeInteger(upstreamLength) || upstreamLength <= 0) {
    return null;
  }
  const end = Math.min(
    requestedRange.end ?? upstreamLength - 1,
    upstreamLength - 1,
  );
  if (requestedRange.start > end) {
    return null;
  }
  return {
    start: requestedRange.start,
    end,
    total: String(upstreamLength),
  };
};

const hasKnownRangeLength = (upstream: Response): boolean => {
  if (upstream.headers.has("content-range")) return true;
  const lengthHeader = upstream.headers.get("content-length");
  if (lengthHeader === null) return false;
  const length = Number(lengthHeader);
  return Number.isSafeInteger(length) && length > 0;
};

export async function GET(request: Request, context: RouteContext) {
  const { token, asset } = await context.params;
  const playback = decodeScrapePlaybackToken(token);

  if (!playback) {
    return NextResponse.json(
      { error: "Invalid playback token" },
      { status: 400 },
    );
  }

  const rangeHeader = request.headers.get("range");

  const startedAt = performance.now();
  let firstUpstreamMs: number | null = null;
  let sessionReminted = false;
  let currentUpstreamUrl = playback.url;

  const logEvent = (
    kind: string,
    status: number,
    extra?: Record<string, unknown>,
  ) => {
    console.info(
      JSON.stringify({
        tag: "scrape-play",
        provider: playback.refresh?.providerId ?? "none",
        host: (() => {
          try {
            return new URL(currentUpstreamUrl).hostname;
          } catch {
            return null;
          }
        })(),
        asset,
        status,
        kind,
        msToUpstream:
          firstUpstreamMs === null ? null : Math.round(firstUpstreamMs),
        msTotal: Math.round(performance.now() - startedAt),
        sessionReminted,
        rangeRequested: rangeHeader,
        ...extra,
      }),
    );
  };

  try {
    const playbackUrl = resolveDashTemplateUrl(playback.url, request.url);
    const upstreamSignal = playUpstreamAbortSignal(
      playbackUrl,
      request.signal,
      asset,
    );
    let upstreamUrl = await resolveScrapePlaybackUpstreamUrl(
      playbackUrl,
      playback.refresh,
    );
    currentUpstreamUrl = upstreamUrl;

    let upstream = await fetchUpstream(
      upstreamUrl,
      playback.referer,
      rangeHeader,
      upstreamSignal,
      playback.cookies,
    );
    firstUpstreamMs = performance.now() - startedAt;

    if (upstream.status === 403) {
      const fallbackUrls = resolveKaaSegmentFallbackUrls(upstreamUrl);
      for (const fallbackUrl of fallbackUrls) {
        await cancelResponseBody(upstream);
        upstreamUrl = fallbackUrl;
        currentUpstreamUrl = upstreamUrl;
        upstream = await fetchUpstream(
          upstreamUrl,
          playback.referer,
          rangeHeader,
          upstreamSignal,
          playback.cookies,
        );
        if (upstream.ok || upstream.status !== 403) {
          break;
        }
      }
    }

    if (
      !upstream.ok &&
      isVidKingPlaybackRefresh(playback.refresh) &&
      isRetryableVidKingUpstreamStatus(upstream.status)
    ) {
      await cancelResponseBody(upstream);
      invalidateVidKingSession(playback.refresh);
      sessionReminted = true;
      upstreamUrl = await resolveScrapePlaybackUpstreamUrl(
        playbackUrl,
        playback.refresh,
        { force: true },
      );
      currentUpstreamUrl = upstreamUrl;
      upstream = await fetchUpstream(
        upstreamUrl,
        playback.referer,
        rangeHeader,
        upstreamSignal,
        playback.cookies,
      );
    }

    if (
      !upstream.ok &&
      isVidsrcPlaybackRefresh(playback.refresh) &&
      isRetryableVidsrcUpstreamStatus(upstream.status)
    ) {
      await cancelResponseBody(upstream);
      invalidateVidsrcJwtSession(playback.refresh);
      sessionReminted = true;
      upstreamUrl = await resolveScrapePlaybackUpstreamUrl(
        playbackUrl,
        playback.refresh,
        { force: true },
      );
      currentUpstreamUrl = upstreamUrl;
      upstream = await fetchUpstream(
        upstreamUrl,
        playback.referer,
        rangeHeader,
        upstreamSignal,
        playback.cookies,
      );
    }

    if (
      !upstream.ok &&
      isVixsrcPlaybackRefresh(playback.refresh) &&
      isRetryableVixsrcUpstreamStatus(upstream.status)
    ) {
      await cancelResponseBody(upstream);
      invalidateVixsrcSession(playback.refresh);
      sessionReminted = true;
      upstreamUrl = await resolveScrapePlaybackUpstreamUrl(
        playbackUrl,
        playback.refresh,
        { force: true },
      );
      currentUpstreamUrl = upstreamUrl;
      upstream = await fetchUpstream(
        upstreamUrl,
        playback.referer,
        rangeHeader,
        upstreamSignal,
        playback.cookies,
      );
    }

    if (
      !upstream.ok &&
      isMegaplayPlaybackRefresh(playback.refresh) &&
      isRetryableMegaplayUpstreamStatus(upstream.status)
    ) {
      await cancelResponseBody(upstream);
      sessionReminted = true;
      upstreamUrl = await resolveScrapePlaybackUpstreamUrl(
        playbackUrl,
        playback.refresh,
      );
      currentUpstreamUrl = upstreamUrl;
      upstream = await fetchUpstream(
        upstreamUrl,
        playback.referer,
        rangeHeader,
        upstreamSignal,
        playback.cookies,
      );
    }

    if (!upstream.ok) {
      const body = await upstream.text().catch(() => "");
      logEvent("upstream-error", upstream.status);
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

      logEvent("dash-manifest", upstream.status);
      return new NextResponse(rewritten, {
        status: upstream.status,
        headers: {
          "Content-Type": "application/dash+xml",
          "Cache-Control": cacheControlForProxiedPlayAsset(upstreamUrl, asset),
        },
      });
    }

    const tryAsPlaylist =
      isPlaylistResponse(upstreamUrl, upstreamContentType) ||
      (!isDisguisedHlsSegment(upstreamUrl) &&
        isAmbiguousPlaylistContentType(upstreamContentType));

    // Body-sniff playlist candidates: extension-less MPEG-TS/MP4 upstreams
    // (vidrock workers, kyren /v1/hls/s/) advertise text/html or match
    // looksLikeHlsStreamUrl, and decoding them as text corrupts every byte
    // that is not valid UTF-8 (U+FFFD replacement).
    let sniffedStream: ReadableStream<Uint8Array> | null = null;
    let sniffedKind: SniffedProxiedBodyKind = "other";
    if (tryAsPlaylist && upstream.body) {
      const sniff = await sniffUpstreamBody(upstream.body);
      sniffedStream = sniff.stream;
      sniffedKind = sniff.kind;
    }

    if (sniffedKind === "mpeg-ts" || sniffedKind === "mp4") {
      const headers = new Headers();
      headers.set(
        "Content-Type",
        sniffedKind === "mpeg-ts" ? "video/mp2t" : "video/mp4",
      );
      headers.set("Cache-Control", CACHE_CONTROL_PLAY_MEDIA);

      const ignoredRange = resolveUpstreamIgnoredRange(upstream, rangeHeader);
      if (ignoredRange) {
        headers.set(
          "Content-Range",
          `bytes ${ignoredRange.start}-${ignoredRange.end}/${ignoredRange.total}`,
        );
        headers.set("Accept-Ranges", "bytes");
        headers.set(
          "Content-Length",
          String(ignoredRange.end - ignoredRange.start + 1),
        );
        logEvent("binary-sliced", 206, {
          sniffed: sniffedKind,
          byteStart: ignoredRange.start,
          byteEnd: ignoredRange.end,
        });
        return new NextResponse(
          sliceStreamToByteRange(
            sniffedStream as ReadableStream<Uint8Array>,
            ignoredRange.start,
            ignoredRange.end,
          ),
          { status: 206, headers },
        );
      }

      for (const key of ["content-length", "content-range"] as const) {
        const value = upstream.headers.get(key);
        if (value) {
          headers.set(key, value);
        }
      }
      if (
        !upstream.headers.get("accept-ranges") &&
        hasKnownRangeLength(upstream)
      ) {
        headers.set("Accept-Ranges", "bytes");
      }

      logEvent("binary-media", upstream.status, { sniffed: sniffedKind });
      return new NextResponse(sniffedStream as ReadableStream<Uint8Array>, {
        status: upstream.status,
        headers,
      });
    }

    if (tryAsPlaylist) {
      const rawPlaylist = sniffedStream
        ? await new Response(sniffedStream).text()
        : await upstream.text();
      const playlist = decodeObfuscatedHlsBody(rawPlaylist);
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

        logEvent("hls-manifest", upstream.status);
        return new NextResponse(rewritten, {
          status: upstream.status,
          headers: {
            "Content-Type": "application/vnd.apple.mpegurl",
            "Cache-Control": cacheControlForProxiedPlayAsset(
              upstreamUrl,
              asset,
            ),
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

        logEvent("dash-manifest-sniffed", upstream.status);
        return new NextResponse(rewritten, {
          status: upstream.status,
          headers: {
            "Content-Type": "application/dash+xml",
            "Cache-Control": cacheControlForProxiedPlayAsset(
              upstreamUrl,
              asset,
            ),
          },
        });
      }

      // Ambiguous CT but not a manifest — return text as-is.
      logEvent("text-asset", upstream.status);
      return new NextResponse(playlist, {
        status: upstream.status,
        headers: {
          ...(upstreamContentType
            ? { "Content-Type": upstreamContentType }
            : {}),
          "Cache-Control": cacheControlForProxiedPlayAsset(upstreamUrl, asset),
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
      asset,
    );
    if (contentType) {
      headers.set("Content-Type", contentType);
    }

    headers.set(
      "Cache-Control",
      cacheControlForProxiedPlayAsset(upstreamUrl, asset),
    );

    // Synthesize seekability when the upstream omits range metadata.
    if (
      !upstream.headers.get("accept-ranges") &&
      hasKnownRangeLength(upstream)
    ) {
      headers.set("Accept-Ranges", "bytes");
    }

    const isSrtCaption = isProxiedPlaySrtCaption(upstreamUrl, asset);
    const rawText =
      playback.subtitleFormat === "ass" ||
      /\.ass(?:[?#].*)?$/i.test(upstreamUrl) ||
      isSrtCaption ||
      /\.vtt(?:[?#].*)?$/i.test(upstreamUrl) ||
      /\.wtt(?:[?#].*)?$/i.test(upstreamUrl)
        ? await upstream.text()
        : null;

    if (rawText === null && upstream.status === 200 && upstream.body) {
      // Upstream ignored the client's Range request (200 full-body) —
      // slice locally so byte-range consumers still get a deterministic 206.
      const ignoredRange = resolveUpstreamIgnoredRange(upstream, rangeHeader);
      if (ignoredRange) {
        headers.set(
          "Content-Range",
          `bytes ${ignoredRange.start}-${ignoredRange.end}/${ignoredRange.total}`,
        );
        headers.set(
          "Content-Length",
          String(ignoredRange.end - ignoredRange.start + 1),
        );
        logEvent("binary-sliced", 206, {
          byteStart: ignoredRange.start,
          byteEnd: ignoredRange.end,
        });
        return new NextResponse(
          sliceStreamToByteRange(
            upstream.body,
            ignoredRange.start,
            ignoredRange.end,
          ),
          { status: 206, headers },
        );
      }
    }

    const body =
      rawText !== null
        ? playback.subtitleFormat === "ass" ||
          /\.ass(?:[?#].*)?$/i.test(upstreamUrl)
          ? convertAssToVtt(rawText)
          : isSrtCaption
            ? convertSrtToVtt(rawText)
            : decodeObfuscatedHlsBody(rawText)
        : upstream.body;

    if (typeof body === "string") {
      headers.delete("content-length");
      headers.delete("content-range");
      headers.delete("accept-ranges");
    }

    logEvent(
      rawText !== null ? "caption-text" : "media-passthrough",
      upstream.status,
    );
    return new NextResponse(body, {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    if (request.signal.aborted) {
      logEvent("client-abort", 499);
      return new NextResponse(null, { status: 499 });
    }
    console.error("Scrape playback proxy failed:", error);
    logEvent("exception", 502);
    return NextResponse.json(
      { error: "Failed to proxy scraped stream" },
      { status: 502 },
    );
  }
}
