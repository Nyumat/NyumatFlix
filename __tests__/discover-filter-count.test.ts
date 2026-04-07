import { describe, expect, it } from "vitest";
import {
  countCatalogFilterBadge,
  countDiscoverFilterSelections,
} from "@/lib/discover-filter-count";

describe("countDiscoverFilterSelections", () => {
  it("counts each genre id in with_genres", () => {
    expect(countDiscoverFilterSelections({ with_genres: "16,35,18" })).toBe(3);
  });

  it("counts pipe-separated watch providers", () => {
    expect(
      countDiscoverFilterSelections({ with_watch_providers: "8|9|337" }),
    ).toBe(3);
  });

  it("counts other discover keys as one each", () => {
    expect(
      countDiscoverFilterSelections({
        with_original_language: "en",
        "vote_average.gte": "7",
      }),
    ).toBe(2);
  });
});

describe("countCatalogFilterBadge", () => {
  it("adds one for catalog year when present", () => {
    expect(
      countCatalogFilterBadge(
        { year: "2020", with_genres: "28" },
        { with_genres: "28" },
      ),
    ).toBe(2);
  });
});
