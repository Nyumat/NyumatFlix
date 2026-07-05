import { describe, expect, it } from "vitest";

import { decodeAllanimeProviderPath } from "@/lib/scrape/anime/allanime-crypto";
import { parseCatPlayerProps } from "@/lib/scrape/anime/html-utils";

describe("anime scrape helpers", () => {
  it("parses KickAssAnime cat-player props manifest", () => {
    const html = `props="{&quot;manifest&quot;:[0,&quot;https://hls.krussdomi.com/manifest/abc/master.m3u8&quot;]}"`;

    expect(parseCatPlayerProps(html)).toEqual({
      manifest: "https://hls.krussdomi.com/manifest/abc/master.m3u8",
    });
  });

  it("decodes AllAnime provider path tokens", () => {
    const encoded =
      "--175948514e4c4f57175b54575b5307515c050f5c0a0c0f0b0f0c0e590a0c0b5b0a0c0e0c0e0a0b0f0e0c";
    const decoded = decodeAllanimeProviderPath(encoded);

    expect(decoded.length).toBeGreaterThan(10);
    expect(decoded).toContain("/clock.json");
  });
});
