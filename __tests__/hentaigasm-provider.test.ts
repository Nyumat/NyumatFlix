import { describe, expect, it } from "vitest";

import {
  buildHentaigasmEpisodeSlug,
  extractHentaigasmStreamUrl,
  findHentaigasmEpisodePath,
  slugifyHentaigasmTitle,
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
