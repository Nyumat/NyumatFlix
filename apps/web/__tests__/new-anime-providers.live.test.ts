import { describe, expect, it } from "vitest";

import { scrapeJustanime } from "@/lib/scrape/anime/providers/justanime";
import { scrapeKyren } from "@/lib/scrape/anime/providers/kyren";

const runLive = process.env.LIVE_SCRAPE === "1";

describe.skipIf(!runLive)("new anime provider scrapers (live)", () => {
  it("JustAnime returns validated-shape HLS for One Piece ep1", async () => {
    const result = await scrapeJustanime({
      anilistId: 21,
      episodeNumber: 1,
      translationType: "sub",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.streamKind).toBe("hls");
    expect(result.streamUrl).toMatch(/\.m3u8(\?|$)/i);
    expect(result.referer).toBeTruthy();
  }, 45_000);

  it("Kyren returns HLS for One Piece ep1", async () => {
    const result = await scrapeKyren({
      anilistId: 21,
      episodeNumber: 1,
      translationType: "sub",
    });

    if (!result.ok) {
      return;
    }
    expect(result.streamKind).toBe("hls");
    expect(result.streamUrl).toMatch(/\.m3u8(\?|$)/i);
  }, 45_000);
});
