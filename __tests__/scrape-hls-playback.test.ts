import { describe, expect, it } from "vitest";
import type { VideoSrc } from "@vidstack/react";

import { isRecoverableScrapeHlsStall } from "@/lib/scrape/hls-quality";
import { SCRAPE_VOD_HLS_CONFIG } from "@/lib/scrape/hls-vod-config";
import {
  buildScrapePlayUrl,
  contentTypeForProxiedAsset,
  decodeScrapePlaybackToken,
  extractScrapePlaybackRefreshFromPlayUrl,
  extractScrapePlaybackTokenFromPlayUrl,
  isAmbiguousPlaylistContentType,
  isPlaylistResponse,
  resolveKaaSegmentFallbackUrl,
  resolveKaaSegmentFallbackUrls,
  rewriteManifestPlaylist,
} from "@/lib/scrape/playback";
import {
  looksLikeHlsPlaylistBody,
  shouldTreatAsHlsPlaylist,
} from "@/lib/scrape/playback-probe";
import {
  buildScrapePlayerKey,
  buildScrapePlayerSrc,
  buildScrapeQualityPlayUrls,
} from "@/lib/scrape/player-sources";

describe("scrape hls playback helpers", () => {
  it("treats non-fatal buffer stalls as recoverable", () => {
    expect(
      isRecoverableScrapeHlsStall({
        fatal: false,
        details: "bufferStalledError",
        type: "mediaError",
      } as never),
    ).toBe(true);

    expect(
      isRecoverableScrapeHlsStall({
        fatal: true,
        details: "bufferStalledError",
        type: "mediaError",
      } as never),
    ).toBe(false);
  });

  it("uses a larger VOD buffer than live playback", () => {
    expect(SCRAPE_VOD_HLS_CONFIG.maxBufferLength).toBeGreaterThan(60);
    expect(SCRAPE_VOD_HLS_CONFIG.lowLatencyMode).toBe(false);
    expect(SCRAPE_VOD_HLS_CONFIG.startPosition).toBe(0);
  });

  it("preserves VidKing refresh metadata on quality fallbacks", () => {
    const streamUrl = "https://shadowlemon.site/r2/cdn2/token/720p/index.m3u8";
    const alternateUrl =
      "https://shadowlemon.site/r2/cdn2/token/480p/index.m3u8";
    const playUrl = buildScrapePlayUrl({
      url: streamUrl,
      referer: "https://www.vidking.net",
      refresh: {
        providerId: "vidking",
        mediaType: "movie",
        tmdbId: 395992,
        seedFetchedAt: 1_783_277_545_589,
      },
    });

    const refresh = extractScrapePlaybackRefreshFromPlayUrl(playUrl);
    expect(refresh?.providerId).toBe("vidking");
    expect(refresh?.tmdbId).toBe(395992);

    const [primary, fallback] = buildScrapeQualityPlayUrls(
      playUrl,
      [{ label: "480p", url: alternateUrl }],
      "https://www.vidking.net",
    );

    expect(primary).toBe(playUrl);
    expect(
      extractScrapePlaybackRefreshFromPlayUrl(fallback ?? "")?.providerId,
    ).toBe("vidking");
  });

  it("exposes scrape qualities as Vidstack player sources", () => {
    const referer = "https://www.vidking.net";
    const playUrl = buildScrapePlayUrl({
      url: "https://shadowlemon.site/r2/cdn2/token/1080p/index.m3u8",
      referer,
    });
    const qualities = [
      {
        label: "1080p",
        url: "https://shadowlemon.site/r2/cdn2/token/1080p/index.m3u8",
      },
      {
        label: "720p",
        url: "https://shadowlemon.site/r2/cdn2/token/720p/index.m3u8",
      },
      {
        label: "480p",
        url: "https://shadowlemon.site/r2/cdn2/token/480p/index.m3u8",
      },
    ];

    const src = buildScrapePlayerSrc(playUrl, qualities, referer);

    expect(Array.isArray(src)).toBe(true);
    if (!Array.isArray(src)) {
      return;
    }

    expect(src).toHaveLength(3);
    expect((src as VideoSrc[]).map((entry) => entry.height)).toEqual([
      1080, 720, 480,
    ]);
  });

  it("keeps a single src for adaptive master playlists", () => {
    const playUrl = buildScrapePlayUrl({
      url: "https://shadowlemon.site/r2/cdn2/token/playlist.m3u8",
    });

    expect(buildScrapePlayerSrc(playUrl, undefined)).toBe(playUrl);
    expect(buildScrapePlayerSrc(playUrl, [])).toBe(playUrl);
  });

  it("treats extensionless HLS URL patterns as playlist responses", () => {
    expect(
      isPlaylistResponse(
        "https://goodstream.cc/pl/abc123tokenizedvaluehere",
        null,
      ),
    ).toBe(true);
    expect(
      isPlaylistResponse("https://vixsrc.to/playlist/xyz", "text/plain"),
    ).toBe(true);
    expect(
      isPlaylistResponse(
        "https://st1.habibikun.xyz/show/episode/213.jpg",
        "image/jpeg",
      ),
    ).toBe(false);
  });

  it("body-sniffs ambiguous content types as HLS playlists", () => {
    expect(isAmbiguousPlaylistContentType("text/plain")).toBe(true);
    expect(isAmbiguousPlaylistContentType("application/octet-stream")).toBe(
      true,
    );
    expect(looksLikeHlsPlaylistBody("#EXTM3U\n#EXTINF:1,\nseg.ts")).toBe(true);
    expect(
      shouldTreatAsHlsPlaylist(
        "https://cdn.example/stream/token",
        "text/plain",
        "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1\nchild.m3u8",
      ),
    ).toBe(true);
    expect(
      shouldTreatAsHlsPlaylist(
        "https://st1.habibikun.xyz/show/episode/213.jpg",
        "image/jpeg",
        "#EXTM3U",
      ),
    ).toBe(false);
  });

  it("rewrites HLS audio, key, and map URI attributes through the proxy", () => {
    const manifestUrl = "https://cdn.example/show/master.m3u8";
    const rewritten = rewriteManifestPlaylist(
      [
        '#EXT-X-MEDIA:TYPE=AUDIO,URI="audio/ja/playlist.m3u8"',
        "#EXT-X-KEY:METHOD=AES-128,URI='keys/video.key'",
        '#EXT-X-MAP:URI="init.mp4"',
      ].join("\n"),
      manifestUrl,
      "https://provider.example/",
    );

    const urls = [...rewritten.matchAll(/URI=["']([^"']+)["']/g)].map(
      (match) => match[1] ?? "",
    );
    const decodedUrls = urls.map((url) => {
      const token = extractScrapePlaybackTokenFromPlayUrl(url);
      return token ? decodeScrapePlaybackToken(token)?.url : undefined;
    });

    expect(decodedUrls).toEqual([
      "https://cdn.example/show/audio/ja/playlist.m3u8",
      "https://cdn.example/show/keys/video.key",
      "https://cdn.example/show/init.mp4",
    ]);
  });

  it("rewrites rotated VidKing segment and key hosts to the playlist origin", () => {
    const manifestUrl =
      "https://working.example/r2/cdn2/token/1080p/index.m3u8";
    const rewritten = rewriteManifestPlaylist(
      [
        '#EXT-X-KEY:METHOD=AES-128,URI="https://stale.example/r2/cdn2/token/1080p/key.bin"',
        "https://stale.example/r2/cdn2/token/1080p/segment.jpg",
      ].join("\n"),
      manifestUrl,
      "https://www.vidking.net/",
      {
        providerId: "vidking",
        mediaType: "movie",
        tmdbId: 27205,
        seedFetchedAt: Date.now(),
      },
    );

    const upstreamUrls = rewritten
      .match(/\/api\/scrape\/play\/[^\s"']+/g)
      ?.map((url) => extractScrapePlaybackTokenFromPlayUrl(url))
      .map((token) => (token ? decodeScrapePlaybackToken(token)?.url : null));

    expect(upstreamUrls).toEqual([
      "https://working.example/r2/cdn2/token/1080p/key.bin",
      "https://working.example/r2/cdn2/token/1080p/segment.jpg",
    ]);
  });

  it("serves disguised AnimeStream pict segments as MPEG-TS", () => {
    expect(
      contentTypeForProxiedAsset(
        "https://cdn.example/show/img-00000.pict",
        "image/x-pict",
      ),
    ).toBe("video/mp2t");
  });

  it("retries blocked KAA segment mirrors across the rotation pool", () => {
    const upstream = "https://st1.habibikun.xyz/show/episode/213.jpg?token=abc";
    const fallbacks = resolveKaaSegmentFallbackUrls(upstream);

    expect(fallbacks).toEqual([
      "https://bl1.advancedairesearchlab.xyz/show/episode/213.jpg?token=abc",
      "https://st1.advancedairesearchlab.xyz/show/episode/213.jpg?token=abc",
      "https://bl1.habibikun.xyz/show/episode/213.jpg?token=abc",
      "https://bl1.babybayw.xyz/show/episode/213.jpg?token=abc",
      "https://st1.babybayw.xyz/show/episode/213.jpg?token=abc",
      "https://bl1.narutokun.xyz/show/episode/213.jpg?token=abc",
      "https://st1.narutokun.xyz/show/episode/213.jpg?token=abc",
    ]);
    expect(fallbacks).not.toContain(upstream);
    expect(resolveKaaSegmentFallbackUrl(upstream)).toBe(fallbacks[0]);
    expect(
      resolveKaaSegmentFallbackUrl("https://unrelated.example/213.jpg"),
    ).toBeNull();
  });

  it("includes stream identity in the player remount key", () => {
    expect(
      buildScrapePlayerKey({
        playUrl: "/api/scrape/play/token/master.m3u8",
        qualities: [{ label: "1080p", url: "https://cdn/1080.m3u8" }],
        subtitles: [{ lang: "en", url: "https://cdn/en.vtt" }],
      }),
    ).toContain("en:https://cdn/en.vtt");
  });
});
