import { describe, expect, it } from "vitest";

import {
  megaplayPlaybackCandidateUrls,
  rewriteMegaplayMirrorStreamUrl,
} from "@/lib/scrape/megaplay-sources";

const HASH_A = "f899139df5e1059396431415e770c6dd";
const HASH_B = "61b87186ab260d05003427e16ccf5657";
const WATCHING = `https://cdn.watching.onl/anime/${HASH_A}/${HASH_B}/master.m3u8`;

describe("megaplay mirror rewrite", () => {
  it("rewrites megap mirror CDNs onto watching.onl", () => {
    expect(
      rewriteMegaplayMirrorStreamUrl(
        `https://megap.mikora.top/${HASH_A}/${HASH_B}/master.m3u8`,
      ),
    ).toBe(WATCHING);
    expect(
      rewriteMegaplayMirrorStreamUrl(
        `https://megap.norami.top/${HASH_A}/${HASH_B}/master.m3u8`,
      ),
    ).toBe(WATCHING);
    expect(
      rewriteMegaplayMirrorStreamUrl(
        `https://megap.shiora.site/${HASH_A}/${HASH_B}/master.m3u8`,
      ),
    ).toBe(WATCHING);
    expect(
      rewriteMegaplayMirrorStreamUrl(
        `https://megap.akirax.buzz/${HASH_A}/${HASH_B}/master.m3u8`,
      ),
    ).toBe(WATCHING);
    expect(
      rewriteMegaplayMirrorStreamUrl(
        `https://megap.kotocdn.site/${HASH_A}/${HASH_B}/master.m3u8`,
      ),
    ).toBe(WATCHING);
  });

  it("leaves watching.onl and unrelated hosts unchanged", () => {
    expect(rewriteMegaplayMirrorStreamUrl(WATCHING)).toBe(WATCHING);
    expect(
      rewriteMegaplayMirrorStreamUrl(
        "https://vivibebe.site/public/stream/a.m3u8",
      ),
    ).toBe("https://vivibebe.site/public/stream/a.m3u8");
  });

  it("prefers watching.onl candidates over momo wrap", () => {
    expect(
      megaplayPlaybackCandidateUrls(
        `https://megap.mikora.top/${HASH_A}/${HASH_B}/master.m3u8`,
      ),
    ).toEqual([WATCHING]);
  });
});
