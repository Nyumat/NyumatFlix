import { describe, expect, it } from "vitest";

import { matchShowcaseRowId } from "@/lib/catalog-showcase-select";

describe("matchShowcaseRowId", () => {
  const movieRows = [
    { rowId: "showcase-comedy", title: "Comedy" },
    { rowId: "showcase-action", title: "Action" },
    { rowId: "showcase-scifi", title: "Science Fiction" },
  ];
  const tvRows = [
    { rowId: "showcase-tv-comedy", title: "Comedy" },
    { rowId: "showcase-tv-action", title: "Action & Adventure" },
    { rowId: "showcase-tv-scifi", title: "Sci-Fi & Fantasy" },
  ];

  it("returns the first row when there is no previous title", () => {
    expect(matchShowcaseRowId(movieRows)).toBe("showcase-comedy");
  });

  it("keeps an exact genre title across movie and series", () => {
    expect(matchShowcaseRowId(tvRows, "Comedy")).toBe("showcase-tv-comedy");
  });

  it("maps Action to Action & Adventure when switching to series", () => {
    expect(matchShowcaseRowId(tvRows, "Action")).toBe("showcase-tv-action");
  });

  it("maps Science Fiction toward Sci-Fi & Fantasy", () => {
    expect(matchShowcaseRowId(tvRows, "Science Fiction")).toBe(
      "showcase-tv-scifi",
    );
  });

  it("falls back to the first row when nothing overlaps", () => {
    expect(matchShowcaseRowId(tvRows, "Romance")).toBe("showcase-tv-comedy");
  });

  it("keeps matching anime genres across series and movies", () => {
    const animeMovieRows = [
      { rowId: "showcase-anime-action", title: "Action" },
      { rowId: "showcase-anime-sci-fi", title: "Sci-Fi" },
    ];
    expect(matchShowcaseRowId(animeMovieRows, "Sci-Fi")).toBe(
      "showcase-anime-sci-fi",
    );
  });
});
