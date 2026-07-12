import { describe, expect, it } from "vitest";

import {
  appendAnimeCdnReferers,
  preferAnimeCdnReferer,
} from "@/lib/scrape/anime/cdn-referer";

describe("anime cdn referer", () => {
  it("prefers vivibebe and megaplay roots for known CDNs", () => {
    expect(
      preferAnimeCdnReferer(
        "https://cdn.vivibebe.site/hls/master.m3u8",
        "https://justanime.to/",
      ),
    ).toBe("https://vivibebe.site/");

    expect(
      preferAnimeCdnReferer(
        "https://mewstream-abc.buzz/hls/master.m3u8",
        "https://justanime.to/",
      ),
    ).toBe("https://megaplay.buzz/");
  });

  it("appends CDN referers for validation probes", () => {
    const seen = new Set<string>();
    const referers: string[] = [];
    appendAnimeCdnReferers(
      "https://cdn.vivibebe.site/hls/master.m3u8",
      referers,
      seen,
    );
    expect(referers).toContain("https://vivibebe.site/");
  });
});
