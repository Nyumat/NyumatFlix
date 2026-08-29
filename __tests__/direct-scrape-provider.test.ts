import { describe, expect, it } from "vitest";

import { pickDirectStreamForScrape } from "@/lib/scrape/providers/direct";
import { SCRAPE_DIRECT_ATTEMPT_TIMEOUT_MS } from "@/lib/scrape/provider-race";

describe("pickDirectStreamForScrape", () => {
  it("skips empty urls and returns the first ranked stream with a url", () => {
    const picked = pickDirectStreamForScrape(
      [
        {
          name: "Empty",
          url: "   ",
          resolution: "2160p",
          size: 20_000_000_000,
          playback: "extended",
        },
        {
          name: "YIFY.1080p.mp4",
          url: "/api/media?u=mp4",
          resolution: "1080p",
          size: 1_000_000_000,
          playback: "direct",
          browserPlayable: true,
        },
        {
          name: "Remux.2160p.mkv",
          url: "/api/media?u=remux",
          resolution: "2160p",
          size: 30_000_000_000,
          playback: "extended",
        },
      ],
      false,
    );

    expect(picked?.url).toBe("/api/media?u=mp4");
  });

  it("returns null when every stream url is empty", () => {
    expect(
      pickDirectStreamForScrape(
        [{ name: "Blank", url: "", resolution: "1080p" }],
        false,
      ),
    ).toBeNull();
  });
});

describe("direct scrape timeout", () => {
  it("matches the 300s json/sse budget when Direct runs alone", () => {
    expect(SCRAPE_DIRECT_ATTEMPT_TIMEOUT_MS).toBe(300_000);
  });
});
