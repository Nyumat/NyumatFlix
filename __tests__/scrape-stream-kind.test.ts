import { describe, expect, it } from "vitest";

import { buildScrapePlayUrl, rewriteDashManifest } from "@/lib/scrape/playback";
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

    expect(rewritten).toContain(
      buildScrapePlayUrl({
        url: "https://cdn.example.com/stream/segments/$Number$.m4s",
        referer: "https://animeonsen.xyz",
      }),
    );
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

  it("uses mpd and mp4 asset suffixes in play URLs", () => {
    expect(
      buildScrapePlayUrl({ url: "https://cdn.example.com/video.mpd" }),
    ).toMatch(/asset\.mpd$/);
    expect(
      buildScrapePlayUrl({ url: "https://cdn.example.com/video.mp4" }),
    ).toMatch(/asset\.mp4$/);
  });
});
