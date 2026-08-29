import { describe, expect, it } from "vitest";

import {
  buildHentaigasmEpisodeSlug,
  buildHentaigasmSearchUrl,
  clearHentaigasmSeriesSlugCache,
  extractHentaigasmStreamUrl,
  findHentaigasmEpisodePath,
  lookupHentaigasmSeriesSlug,
  parseHentaigasmEpisodeSlug,
  parseHentaigasmWpPosts,
  pickHentaigasmWpEpisode,
  rememberHentaigasmSeriesSlug,
  slugifyHentaigasmTitle,
  stripHentaigasmPostTitle,
} from "@/lib/scrape/anime/providers/hentaigasm";
import {
  shouldIncludeHentaigasmForGenres,
  shouldIncludeHentaigasmProvider,
} from "@/lib/scrape/anime/hentaigasm-eligible";

describe("hentaigasm provider helpers", () => {
  it("slugifies titles for hentaigasm paths", () => {
    expect(slugifyHentaigasmTitle("Modaete Yo Adam-Kun Uncensored")).toBe(
      "modaete-yo-adam-kun-uncensored",
    );
    expect(buildHentaigasmEpisodeSlug("hamehara", 1)).toBe("hamehara-1-subbed");
  });

  it("extracts direct mp4 urls from jwplayer setup", () => {
    const html = `jwplayer("player_01").setup({
file: "https://hgasm2.com/Modaete Yo Adam-Kun Uncensored 1 Subbed.mp4",
image: "https://hgasm1.com/thumbnail/example.jpg",
});`;

    expect(extractHentaigasmStreamUrl(html)).toBe(
      "https://hgasm2.com/Modaete Yo Adam-Kun Uncensored 1 Subbed.mp4",
    );
  });

  it("finds episode links on series pages", () => {
    const html = `<a class="clip-link" href="https://hentaigasm.com/modaete-yo-adam-kun-uncensored-3-subbed/">`;

    expect(findHentaigasmEpisodePath(html, 3)).toBe(
      "/modaete-yo-adam-kun-uncensored-3-subbed/",
    );
  });

  it("ignores other series on mixed archive pages when a slug is given", () => {
    const html = `
      <a href="https://hentaigasm.com/mankitsu-happening-4-subbed/">
      <a href="https://hentaigasm.com/hebi-to-kumo-1-subbed/">
      <a href="https://hentaigasm.com/mankitsu-happening-1-subbed/">
    `;

    expect(findHentaigasmEpisodePath(html, 1)).toBe("/hebi-to-kumo-1-subbed/");
    expect(findHentaigasmEpisodePath(html, 1, "mankitsu-happening")).toBe(
      "/mankitsu-happening-1-subbed/",
    );
  });

  it("parses WordPress episode slugs and post titles", () => {
    expect(parseHentaigasmEpisodeSlug("mankitsu-happening-1-subbed")).toEqual({
      seriesSlug: "mankitsu-happening",
      episodeNumber: 1,
    });
    expect(stripHentaigasmPostTitle("Mankitsu Happening 1 Subbed")).toBe(
      "Mankitsu Happening",
    );
    expect(buildHentaigasmSearchUrl("Mankitsu Happening")).toContain(
      "search=Mankitsu+Happening",
    );
  });

  it("picks the matching WP search hit and ignores unrelated titles", () => {
    const posts = parseHentaigasmWpPosts(
      JSON.stringify([
        {
          slug: "mankitsu-happening-4-subbed",
          link: "https://hentaigasm.com/mankitsu-happening-4-subbed/",
          status: "publish",
          title: { rendered: "Mankitsu Happening 4 Subbed" },
        },
        {
          slug: "mankitsu-happening-1-subbed",
          link: "https://hentaigasm.com/mankitsu-happening-1-subbed/",
          status: "publish",
          title: { rendered: "Mankitsu Happening 1 Subbed" },
        },
        {
          slug: "hebi-to-kumo-1-subbed",
          link: "https://hentaigasm.com/hebi-to-kumo-1-subbed/",
          status: "publish",
          title: { rendered: "Hebi to Kumo 1 Subbed" },
        },
      ]),
    );

    expect(
      pickHentaigasmWpEpisode(
        posts,
        ["Mankitsu Happening", "Manga Café Mishaps"],
        ["mankitsu-happening", "manga-cafe-mishaps"],
        1,
      ),
    ).toEqual({
      slug: "mankitsu-happening-1-subbed",
      link: "https://hentaigasm.com/mankitsu-happening-1-subbed/",
      title: "Mankitsu Happening 1 Subbed",
    });

    expect(
      pickHentaigasmWpEpisode(
        posts,
        ["Horete Osowarete: Two Lovers"],
        ["horete-osowarete-two-lovers", "twolovers"],
        1,
      ),
    ).toBeNull();
  });

  it("matches WP hits by post title when the AniList slug differs", () => {
    const posts = parseHentaigasmWpPosts(
      JSON.stringify([
        {
          slug: "mankitsu-happening-1-subbed",
          link: "https://hentaigasm.com/mankitsu-happening-1-subbed/",
          status: "publish",
          title: { rendered: "Mankitsu Happening 1 Subbed" },
        },
      ]),
    );

    expect(
      pickHentaigasmWpEpisode(
        posts,
        ["Mankitsu Happening"],
        ["manga-cafe-mishaps"],
        1,
      )?.slug,
    ).toBe("mankitsu-happening-1-subbed");
  });

  it("fuzzy matches WP hits when the site title has typos the AniList title lacks", () => {
    const posts = parseHentaigasmWpPosts(
      JSON.stringify([
        {
          slug: "jimihen-jimko-wo-kaechau-jun-isei-kouyouu-6-subbed",
          link: "https://hentaigasm.com/jimihen-jimko-wo-kaechau-jun-isei-kouyouu-6-subbed/",
          status: "publish",
          title: {
            rendered:
              "Jimihen!! Jimko Wo Kaechau Jun Isei Kouyouu!! Uncensored 6 Subbed",
          },
        },
      ]),
    );

    expect(
      pickHentaigasmWpEpisode(
        posts,
        ["Jimihen!!: Jimiko wo Kaechau Jun Isei Kouyuu", "Simple yet Sexy"],
        ["jimihen-jimiko-wo-kaechau-jun-isei-kouyuu"],
        6,
      )?.slug,
    ).toBe("jimihen-jimko-wo-kaechau-jun-isei-kouyouu-6-subbed");
  });

  it("caches the discovered series slug keyed by anilist id", () => {
    clearHentaigasmSeriesSlugCache();
    expect(lookupHentaigasmSeriesSlug(42)).toBeNull();
    rememberHentaigasmSeriesSlug(
      42,
      "jimihen-jimko-wo-kaechau-jun-isei-kouyouu",
    );
    expect(lookupHentaigasmSeriesSlug(42)).toBe(
      "jimihen-jimko-wo-kaechau-jun-isei-kouyouu",
    );
    clearHentaigasmSeriesSlugCache();
    expect(lookupHentaigasmSeriesSlug(42)).toBeNull();
  });

  it("limits hentaigasm to adult or Hentai-genre titles", () => {
    expect(
      shouldIncludeHentaigasmProvider({
        isAdult: true,
        genres: ["Romance"],
      }),
    ).toBe(true);

    expect(
      shouldIncludeHentaigasmProvider({
        isAdult: false,
        genres: ["Hentai", "Romance"],
      }),
    ).toBe(true);

    expect(
      shouldIncludeHentaigasmProvider({
        isAdult: false,
        genres: ["Action", "Romance"],
      }),
    ).toBe(false);

    expect(shouldIncludeHentaigasmForGenres(false, ["Hentai"])).toBe(true);
    expect(shouldIncludeHentaigasmForGenres(false, ["Action"])).toBe(false);
  });
});
