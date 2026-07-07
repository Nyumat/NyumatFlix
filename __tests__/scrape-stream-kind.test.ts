import { describe, expect, it } from "vitest";

import {
  buildScrapePlayUrl,
  decodeScrapePlaybackToken,
  extractScrapePlaybackTokenFromPlayUrl,
  resolveDashTemplateUrl,
  rewriteDashManifest,
} from "@/lib/scrape/playback";
import { buildScrapeMediaPlayerSrc } from "@/lib/scrape/stream-kind";

describe("scrape stream kind helpers", () => {
  it("builds Vidstack src objects for dash and mp4", () => {
    const playUrl = "/api/scrape/play/token/asset.mpd";

    expect(buildScrapeMediaPlayerSrc(playUrl, "hls")).toBe(playUrl);
    expect(buildScrapeMediaPlayerSrc(playUrl, "dash")).toEqual({
      src: playUrl,
      type: "application/dash+xml",
    });
    expect(buildScrapeMediaPlayerSrc(playUrl, "mp4")).toEqual({
      src: playUrl,
      type: "video/mp4",
    });
  });

  it("rewrites dash manifest segment URLs through the playback proxy", () => {
    const manifestUrl = "https://cdn.example.com/stream/episode.mpd";
    const manifest = `<?xml version="1.0"?>
<MPD>
  <Period>
    <AdaptationSet>
      <SegmentTemplate media="segments/$Number$.m4s" initialization="init.mp4" />
      <BaseURL>https://cdn.example.com/stream/</BaseURL>
    </AdaptationSet>
  </Period>
</MPD>`;

    const rewritten = rewriteDashManifest(
      manifest,
      manifestUrl,
      "https://animeonsen.xyz",
    );

    expect(rewritten).toContain("?dash-template-0=$Number$");
    expect(rewritten).toContain(
      buildScrapePlayUrl({
        url: "https://cdn.example.com/stream/init.mp4",
        referer: "https://animeonsen.xyz",
      }),
    );
    expect(rewritten).toContain(
      buildScrapePlayUrl({
        url: "https://cdn.example.com/stream/",
        referer: "https://animeonsen.xyz",
      }),
    );
  });

  it("resolves substituted dash template values at the proxy boundary", () => {
    const manifestUrl = "https://cdn.example.com/stream/episode.mpd";
    const manifest = `<SegmentTemplate initialization="stream_init$RepresentationID$.m4s" media="$RepresentationID$-seg-$Number%08d$.m4s" />`;
    const rewritten = rewriteDashManifest(manifest, manifestUrl);
    const mediaUrl = rewritten.match(/media="([^"]+)"/)?.[1];

    expect(mediaUrl).toBeDefined();
    const substituted = mediaUrl!
      .replace("$RepresentationID$", "1")
      .replace("$Number%08d$", "00000042");
    const token = extractScrapePlaybackTokenFromPlayUrl(substituted);
    const playback = token ? decodeScrapePlaybackToken(token) : null;

    expect(playback).not.toBeNull();
    expect(
      resolveDashTemplateUrl(
        playback!.url,
        `http://localhost:3000${substituted}`,
      ),
    ).toBe("https://cdn.example.com/stream/1-seg-00000042.m4s");
  });

  it("rejects unsafe dash template substitutions", () => {
    expect(
      resolveDashTemplateUrl(
        "https://cdn.example.com/$RepresentationID$/segment.m4s",
        "http://localhost:3000/proxy?dash-template-0=%2F%2Fevil.example",
      ),
    ).toBe("https://cdn.example.com/$RepresentationID$/segment.m4s");
  });

  it("uses mpd and mp4 asset suffixes in play URLs", () => {
    expect(
      buildScrapePlayUrl({ url: "https://cdn.example.com/video.mpd" }),
    ).toMatch(/asset\.mpd$/);
    expect(
      buildScrapePlayUrl({ url: "https://cdn.example.com/video.mp4" }),
    ).toMatch(/asset\.mp4$/);
  });
});
