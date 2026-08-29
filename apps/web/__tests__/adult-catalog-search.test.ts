import { describe, expect, it } from "vitest";

import {
  adultCatalogSlugToSearchQueries,
  buildAdultCatalogSearchQueries,
  compactAdultCatalogTokens,
  significantAdultCatalogWords,
  stripAdultCatalogSubtitle,
} from "@/lib/scrape/anime/adult-catalog-search";
import { expandAdultAnimeSearchQueries } from "@/lib/scrape/anime/adult-title-slug-aliases";

describe("adult catalog search queries", () => {
  it("strips explanatory subtitles after a colon", () => {
    expect(
      stripAdultCatalogSubtitle(
        "Joshi Ochi!: 2-kai kara Onna no Ko ga... Futte kita!?",
      ),
    ).toBe("Joshi Ochi");
  });

  it("builds short franchise queries that WP search accepts", () => {
    const queries = buildAdultCatalogSearchQueries([
      "Joshi Ochi!: 2-kai kara Onna no Ko ga... Futte kita!?",
    ]);

    expect(queries[0]).toBe("Joshi Ochi");
    expect(queries).toEqual(
      expect.arrayContaining(["Joshiochi", "joshiochi", "Joshi Ochi"]),
    );
    expect(queries).not.toContain(
      "Joshi Ochi!: 2-kai kara Onna no Ko ga... Futte kita!?",
    );
  });

  it("still includes full titles and known adult aliases", () => {
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

  it("derives compact and prefix queries from slug candidates", () => {
    expect(
      adultCatalogSlugToSearchQueries(
        "joshi-ochi-2-kai-kara-onna-no-ko-ga-futte-kita",
      ),
    ).toEqual(expect.arrayContaining(["Joshi Ochi", "Joshiochi", "joshiochi"]));
  });

  it("compacts adjacent romanization tokens", () => {
    expect(compactAdultCatalogTokens(["Onna", "no", "Ko"], 0, 3)).toBe(
      "onnanoko",
    );
  });
});
