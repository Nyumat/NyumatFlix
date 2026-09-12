import { describe, expect, it } from "vitest";

import {
  buildManifestId,
  manifestSessionKey,
  toPlayableManifestFromDirect,
  toPlayableManifestFromScrape,
} from "@/lib/playback/to-playable-manifest";
import type { DirectStream } from "@nyumatflix/playback";
import { selectPlaybackShellEngine } from "@/lib/playback/select-playback-engine";

const directStream: DirectStream = {
  name: "1080p",
  resolution: "1080p",
  size: 1_500_000_000,
  url: "https://example.com/stream.m3u8",
  playback: "hls",
  cached: true,
  hash: "abc123",
  fileName: "movie.mkv",
};

describe("toPlayableManifestFromScrape", () => {
  it("maps scrape HLS payload", () => {
    const manifest = toPlayableManifestFromScrape({
      providerId: "vidking",
      providerName: "VidKing",
      playUrl: "/api/scrape/play/token/master.m3u8",
      streamKind: "hls",
      subtitles: [{ lang: "en", url: "/subs/en.vtt" }],
    });

    expect(manifest.origin).toBe("scrape");
    expect(manifest.kind).toBe("hls");
    expect(manifest.providerId).toBe("vidking");
    expect(manifest.subtitles).toHaveLength(1);
  });

  it("maps direct-via-scrape payload", () => {
    const manifest = toPlayableManifestFromScrape({
      providerId: "direct",
      providerName: "Direct",
      playUrl: "https://example.com/hls.m3u8",
      directPlayback: "hls",
      directFallbackUrl: "https://example.com/fallback.mp4",
    });

    expect(manifest.origin).toBe("direct");
    expect(manifest.fallbackUrl).toBe("https://example.com/fallback.mp4");
  });

  it("infers dash kind from play url", () => {
    const manifest = toPlayableManifestFromScrape({
      providerId: "animeonsen",
      providerName: "AnimeOnsen",
      playUrl: "/api/scrape/play/token/asset.mpd",
    });

    expect(manifest.kind).toBe("dash");
  });
});

describe("toPlayableManifestFromDirect", () => {
  it("maps direct stream with candidates", () => {
    const manifest = toPlayableManifestFromDirect(
      directStream,
      [directStream],
      "Direct",
    );

    expect(manifest.origin).toBe("direct");
    expect(manifest.directStream?.hash).toBe("abc123");
    expect(manifest.directCandidates).toHaveLength(1);
  });
});

describe("manifestSessionKey", () => {
  it("is stable for same manifest inputs", () => {
    const manifest = toPlayableManifestFromScrape({
      providerId: "bingr",
      providerName: "Bingr",
      playUrl: "https://example.com/play.m3u8",
      qualities: [{ label: "1080p", url: "https://example.com/1080.m3u8" }],
    });

    const a = manifestSessionKey(manifest);
    const b = manifestSessionKey(manifest);
    expect(a).toBe(b);
  });
});

describe("selectPlaybackShellEngine", () => {
  it("routes direct manifests to direct engine", () => {
    const manifest = toPlayableManifestFromDirect(directStream, [directStream]);
    expect(
      selectPlaybackShellEngine(manifest, { userEngine: "vidstack" }),
    ).toBe("direct");
  });

  it("routes movi preference for scrape hls", () => {
    const manifest = toPlayableManifestFromScrape({
      providerId: "vidking",
      providerName: "VidKing",
      playUrl: "https://example.com/play.m3u8",
    });
    expect(selectPlaybackShellEngine(manifest, { userEngine: "movi" })).toBe(
      "movi",
    );
  });

  it("routes dash manifests to vidstack even when movi is preferred", () => {
    const manifest = toPlayableManifestFromScrape({
      providerId: "animeonsen",
      providerName: "AnimeOnsen",
      playUrl: "/api/scrape/play/token/asset.mpd",
      streamKind: "dash",
    });
    expect(selectPlaybackShellEngine(manifest, { userEngine: "movi" })).toBe(
      "vidstack",
    );
  });

  it("caps dash startup subtitles to a small preferred set", () => {
    const manifest = toPlayableManifestFromScrape({
      providerId: "animeonsen",
      providerName: "AnimeOnsen",
      playUrl: "/api/scrape/play/token/asset.mpd",
      streamKind: "dash",
      preferredAudioLang: "en-US",
      subtitles: [
        { lang: "de-DE", url: "https://example.com/de.vtt" },
        { lang: "en-US", url: "https://example.com/en.vtt" },
        { lang: "es-ES", url: "https://example.com/es.vtt" },
        { lang: "fr-FR", url: "https://example.com/fr.vtt" },
        { lang: "ja-JP", url: "https://example.com/ja.vtt" },
      ],
    });

    expect(manifest.subtitles).toHaveLength(3);
    expect(manifest.subtitles.map((track) => track.lang)).toEqual([
      "en-US",
      "de-DE",
      "es-ES",
    ]);
  });
});

describe("buildManifestId", () => {
  it("includes provider and url", () => {
    const id = buildManifestId({
      providerId: "vidsrc",
      playUrl: "https://example.com/x.m3u8",
    });
    expect(id).toContain("vidsrc");
    expect(id).toContain("x.m3u8");
  });
});
