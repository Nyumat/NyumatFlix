import { describe, expect, it } from "vitest";

import {
  buildHentainiEpisodePath,
  expandHentainiSlugVariants,
  slugifyHentainiTitle,
} from "@/lib/scrape/anime/hentaini-slug";
import {
  extractHentainiStreamUrl,
  findHentainiEpisodePath,
} from "@/lib/scrape/anime/providers/hentaini";

describe("hentaini provider helpers", () => {
  it("slugifies titles for hentaini paths", () => {
    expect(slugifyHentainiTitle("Succubus Yondara Haha ga Kita!?")).toBe(
      "succubus-yondara-haha-ga-kita",
    );
    expect(buildHentainiEpisodePath("succubus-yondara-haha-ga-kita", 2)).toBe(
      "/h/succubus-yondara-haha-ga-kita/2",
    );
  });

  it("expands junyuu-chuu slug variants", () => {
    expect(expandHentainiSlugVariants("ane-wa-yanmama-junyuu-chuu")).toContain(
      "ane-wa-yanmama-junyuuchuu",
    );
  });

  it("extracts HLS urls from episode metadata", () => {
    const html = `{"embedUrl":"https://vs1.yesterdaymail.com/series/5/11/5-11.m3u8","isAccessibleForFree":true}`;

    expect(extractHentainiStreamUrl(html)).toBe(
      "https://vs1.yesterdaymail.com/series/5/11/5-11.m3u8",
    );
  });

  it("finds episode links on series pages", () => {
    const html = `<a href="/h/ane-wa-yanmama-junyuuchuu/2">Episode 2</a>`;

    expect(findHentainiEpisodePath(html, "ane-wa-yanmama-junyuuchuu", 2)).toBe(
      "/h/ane-wa-yanmama-junyuuchuu/2",
    );
  });
});
