import { describe, expect, it } from "vitest";

import {
  ANINEKO_MIRRORS,
  rankJustanimeSources,
} from "@/lib/scrape/anime/providers/justanime";
import {
  KYREN_SERVERS_DUB,
  KYREN_SERVERS_SUB,
  rankKyrenSources,
} from "@/lib/scrape/anime/providers/kyren";

describe("kyren server cycling", () => {
  it("keeps sub servers in viper → kayo → raze → jett order", () => {
    expect([...KYREN_SERVERS_SUB]).toEqual(["viper", "kayo", "raze", "jett"]);
  });

  it("ranks 1080p ahead of 720p so cycling still prefers quality", () => {
    const ranked = rankKyrenSources([
      {
        provider: "pahe",
        quality: "720p",
        url: "https://api.kyren.moe/v1/hls/m/lo",
      },
      {
        provider: "pahe",
        quality: "1080p",
        url: "https://api.kyren.moe/v1/hls/m/hi",
      },
    ]);
    expect(ranked.map((source) => source.quality)).toEqual(["1080p", "720p"]);
  });

  it("includes raze before jett on both sub and dub lists", () => {
    expect(KYREN_SERVERS_SUB.indexOf("raze")).toBeLessThan(
      KYREN_SERVERS_SUB.indexOf("jett"),
    );
    expect(KYREN_SERVERS_DUB.indexOf("raze")).toBeLessThan(
      KYREN_SERVERS_DUB.indexOf("jett"),
    );
  });
});

describe("justanime source cycling", () => {
  it("tries anineko hd2 before hd3 before hd1", () => {
    expect([...ANINEKO_MIRRORS]).toEqual(["hd2", "hd3", "hd1"]);
  });

  it("skips non-hls sources and ranks auto below 1080p", () => {
    const ranked = rankJustanimeSources([
      { url: "https://cdn.example/360.m3u8", quality: "360p", isM3U8: true },
      { url: "https://cdn.example/clip.mp4", quality: "1080p", isM3U8: false },
      { url: "https://cdn.example/auto.m3u8", quality: "auto", isM3U8: true },
      { url: "https://cdn.example/1080.m3u8", quality: "1080p" },
    ]);
    expect(ranked.map((source) => source.quality)).toEqual([
      "1080p",
      "auto",
      "360p",
    ]);
  });
});
