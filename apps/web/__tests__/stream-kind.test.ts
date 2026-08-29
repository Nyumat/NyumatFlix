import { describe, expect, it } from "vitest";

import { buildScrapeMediaPlayerSrc } from "@/lib/scrape/stream-kind";

describe("buildScrapeMediaPlayerSrc", () => {
  it("sets explicit HLS mime for transcode playlist urls", () => {
    expect(
      buildScrapeMediaPlayerSrc(
        "http://localhost:3000/api/direct/transcode/playlist?u=upstream",
        "hls",
      ),
    ).toEqual({
      src: "http://localhost:3000/api/direct/transcode/playlist?u=upstream",
      type: "application/vnd.apple.mpegurl",
    });
  });
});
