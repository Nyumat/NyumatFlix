import { describe, expect, it } from "vitest";

import { animeShowcaseRowId } from "@/lib/anime-showcase";

describe("animeShowcaseRowId", () => {
  it("slugifies AniList genre names", () => {
    expect(animeShowcaseRowId("Action")).toBe("showcase-anime-action");
    expect(animeShowcaseRowId("Sci-Fi")).toBe("showcase-anime-sci-fi");
    expect(animeShowcaseRowId("Slice of Life")).toBe(
      "showcase-anime-slice-of-life",
    );
    expect(animeShowcaseRowId("Hentai")).toBe("showcase-anime-hentai");
  });
});
