import { describe, expect, it } from "vitest";

import {
  isJustanimeMomoProxyUrl,
  unwrapJustanimeMomoProxyUrl,
  wrapJustanimeMegaplayStreamUrl,
  wrapJustanimeMomoProxyUrl,
} from "@/lib/scrape/justanime-momo-proxy";
import { isMegaplayMasterPlaybackUrl } from "@/lib/scrape/megaplay-playback";
import type { MegaplayPlaybackRefresh } from "@/lib/scrape/megaplay-constants";
import { preferAnimeCdnReferer } from "@/lib/scrape/anime/cdn-referer";

describe("justanime momo proxy", () => {
  const master = "https://cdn.mewstream.buzz/anime/abc/123/master.m3u8";

  it("wraps mewstream masters for megaplay playback", () => {
    const wrapped = wrapJustanimeMegaplayStreamUrl(master);
    expect(wrapped).toContain("momo.justanime.to/proxy?url=");
    expect(unwrapJustanimeMomoProxyUrl(wrapped)).toBe(master);
  });

  it("detects momo proxy URLs from workers.dev mirrors", () => {
    const workers = wrapJustanimeMomoProxyUrl(
      master,
      "https://momo.alright-rabbit.workers.dev/proxy?url=",
    );
    expect(isJustanimeMomoProxyUrl(workers)).toBe(true);
    expect(unwrapJustanimeMomoProxyUrl(workers)).toBe(master);
  });

  it("matches megaplay refresh against wrapped master URLs", () => {
    const refresh: MegaplayPlaybackRefresh = {
      providerId: "megaplay",
      referer: "https://justanime.to/",
      seedStreamUrl: master,
      justanime: {
        anilistId: 20665,
        episodeNumber: 2,
        translationType: "sub",
      },
    };

    expect(
      isMegaplayMasterPlaybackUrl(
        wrapJustanimeMegaplayStreamUrl(master),
        refresh,
      ),
    ).toBe(true);
  });

  it("uses justanime referer for momo proxy streams", () => {
    expect(
      preferAnimeCdnReferer(
        wrapJustanimeMegaplayStreamUrl(master),
        "https://megaplay.buzz/",
      ),
    ).toBe("https://justanime.to/");
  });
});
