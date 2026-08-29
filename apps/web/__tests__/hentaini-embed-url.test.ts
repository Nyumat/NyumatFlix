import { describe, expect, it } from "vitest";

import {
  buildHentainiAnimeUrl,
  resolveHentainiAnimeSlug,
} from "@/lib/providers/embed-urls";

describe("hentaini embed urls", () => {
  it("resolves Fuuki Iin to Fuuzoku Katsudou from AniList id 186827", () => {
    expect(
      resolveHentainiAnimeSlug(186827, {
        vidsrcApi: "1",
        animePreference: "sub",
      }),
    ).toBe("fuuki-iin-to-fuuzoku-katsudou");
    expect(
      buildHentainiAnimeUrl(186827, 1, {
        vidsrcApi: "1",
        animePreference: "sub",
      }),
    ).toBe("https://hentaini.com/h/fuuki-iin-to-fuuzoku-katsudou/1");
  });

  it("falls back to slugified romaji title when no explicit map exists", () => {
    expect(
      resolveHentainiAnimeSlug(1, {
        vidsrcApi: "1",
        animePreference: "sub",
        animeTitleSlug: "cowboy-bebop",
      }),
    ).toBe("cowboy-bebop");
  });
});
