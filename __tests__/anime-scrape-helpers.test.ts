import { describe, expect, it } from "vitest";

import { decodeAllanimeProviderPath } from "@/lib/scrape/anime/allanime-crypto";
import {
  parseCatPlayerProps,
  unpackDeanEdwardsScripts,
} from "@/lib/scrape/anime/html-utils";
import { selectAllmangaShow } from "@/lib/scrape/anime/providers/allmanga";

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

  it("selects the base AllManga series instead of a similarly named sequel", () => {
    const selected = selectAllmangaShow(
      [
        { _id: "more", name: "Boku no Hero Academia: More" },
        { _id: "final", name: "Boku no Hero Academia Final Season" },
        { _id: "base", name: "Boku no Hero Academia" },
      ],
      "My Hero Academia",
    );

    expect(selected?._id).toBe("base");
  });

  it("unpacks Dean Edwards scripts without evaluating them", () => {
    const packed =
      "eval(function(p,a,c,k,e,d){return p}('0 1=\\'2://3/4.5\\';',62,6,'var|url|https|cdn.example|master|m3u8'.split('|'),0,{}))";

    expect(unpackDeanEdwardsScripts(packed)).toEqual([
      "var url='https://cdn.example/master.m3u8';",
    ]);
  });
});
