import { describe, expect, it } from "vitest";

import { resolveHlsPlaylistUrl } from "@/lib/scrape/hls-url";

describe("resolveHlsPlaylistUrl", () => {
  it("inherits parent query for relative same-host children", () => {
    expect(
      resolveHlsPlaylistUrl(
        "seg.ts",
        "https://cdn.example.com/pl.m3u8?t=token",
      ),
    ).toBe("https://cdn.example.com/seg.ts?t=token");
  });

  it("does not paste playlist tokens onto absolute cross-origin segments", () => {
    expect(
      resolveHlsPlaylistUrl(
        "https://cdn.ani.pm/m/abc/seg.jpg",
        "https://ani.pm/api/anime/src/hls?t=playlist-token",
      ),
    ).toBe("https://cdn.ani.pm/m/abc/seg.jpg");
  });
});
