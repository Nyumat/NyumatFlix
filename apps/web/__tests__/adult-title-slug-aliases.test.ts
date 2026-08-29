import { describe, expect, it } from "vitest";

import {
  expandAdultAnimeSearchQueries,
  expandAdultAnimeSlugAliases,
} from "@/lib/scrape/anime/adult-title-slug-aliases";
import { buildHentaigasmEpisodeSlug } from "@/lib/scrape/anime/providers/hentaigasm";
import { toAnipmEpisodeSlug } from "@/lib/scrape/anime/providers/anipm";

describe("adult title slug aliases", () => {
  it("expands yanmama and gibo/haha slug variants", () => {
    expect(expandAdultAnimeSlugAliases("ane-wa-yanmama-junyuu-chuu")).toEqual([
      "ane-wa-yanmama-junyuu-chuu",
      "ane-wa-yan-mama-junyuu-chuu",
    ]);
    expect(
      expandAdultAnimeSlugAliases("succubus-yondara-haha-ga-kita-1"),
    ).toContain("succubus-yondara-gibo-ga-kita-1");
  });

  it("adds spaced search queries for compound adult titles", () => {
    expect(
      expandAdultAnimeSearchQueries([
        "Ane wa Yanmama Junyuu-chuu",
        "Succubus Yondara Haha ga Kita!?",
      ]),
    ).toEqual(
      expect.arrayContaining([
        "Ane wa Yanmama Junyuu-chuu",
        "Ane wa yan mama Junyuu-chuu",
        "Succubus Yondara Haha ga Kita!?",
        "Succubus Yondara Gibo ga kita!?",
      ]),
    );
  });

  it("maps hentaigasm episode paths for yan-mama slug", () => {
    expect(buildHentaigasmEpisodeSlug("ane-wa-yan-mama-junyuu-chuu", 1)).toBe(
      "ane-wa-yan-mama-junyuu-chuu-1-subbed",
    );
  });

  it("maps ani.pm episode slugs across gibo/haha naming", () => {
    expect(toAnipmEpisodeSlug("succubus-yondara-haha-ga-kita-2", 1)).toBe(
      "succubus-yondara-haha-ga-kita-1",
    );
    expect(
      expandAdultAnimeSlugAliases(
        toAnipmEpisodeSlug("succubus-yondara-haha-ga-kita-2", 1),
      ),
    ).toContain("succubus-yondara-gibo-ga-kita-1");
  });
});
