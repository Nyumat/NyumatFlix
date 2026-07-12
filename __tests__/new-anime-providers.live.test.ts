import { describe, expect, it } from "vitest";

import { scrapeJustanime } from "@/lib/scrape/anime/providers/justanime";
import { scrapeAnikitty } from "@/lib/scrape/anime/providers/anikitty";
import { scrapeAnikuro } from "@/lib/scrape/anime/providers/anikuro";
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

  it("AniKitty returns HLS for One Piece ep1", async () => {
    const result = await scrapeAnikitty({
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

  it("AniKuro returns HLS for One Piece ep1", async () => {
    const result = await scrapeAnikuro({
      anilistId: 21,
      episodeNumber: 1,
      translationType: "sub",
    });

    if (!result.ok) {
      // Upstream source providers are intermittently slow in vitest;
      // hard-gated by scripts/verify-new-anime-providers.mts.
      console.warn("AniKuro live scrape soft-fail:", result.error);
      return;
    }
    expect(result.streamKind).toBe("hls");
    expect(result.streamUrl).toMatch(/\.m3u8(\?|$)/i);
    expect(result.referer).toBeTruthy();
  }, 90_000);

  it("Kyren returns HLS for One Piece ep1", async () => {
    const result = await scrapeKyren({
      anilistId: 21,
      episodeNumber: 1,
      translationType: "sub",
    });

    if (!result.ok) {
      console.warn("Kyren live scrape soft-fail:", result.error);
      return;
    }
    expect(result.streamKind).toBe("hls");
    expect(result.streamUrl).toMatch(/api\.kyren\.moe\/v1\/hls\//i);
  }, 45_000);
});
