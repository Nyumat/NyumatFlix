import { describe, expect, it } from "vitest";

import { COMMUNITY_WATCHING_EXCLUDED_TMDB_TV_ID } from "@/lib/analytics/community-watching-exclusions";
import {
  filterFamilySafeCatalogShowcaseItems,
  isFamilySafeCatalogShowcaseItem,
} from "@/lib/catalog-showcase-family-safe";

describe("catalog showcase family-safe filter", () => {
  it("drops TMDB adult-flagged items", () => {
    expect(
      isFamilySafeCatalogShowcaseItem({
        id: 1,
        adult: true,
        media_type: "tv",
      }),
    ).toBe(false);
  });

  it("drops known excluded adult animation tv ids", () => {
    expect(
      isFamilySafeCatalogShowcaseItem({
        id: COMMUNITY_WATCHING_EXCLUDED_TMDB_TV_ID,
        adult: false,
        media_type: "tv",
      }),
    ).toBe(false);
  });

  it("keeps mainstream animation series", () => {
    expect(
      filterFamilySafeCatalogShowcaseItems([
        { id: 95479, adult: false, media_type: "tv" },
        { id: 1, adult: true, media_type: "tv" },
      ]),
    ).toEqual([{ id: 95479, adult: false, media_type: "tv" }]);
  });
});
