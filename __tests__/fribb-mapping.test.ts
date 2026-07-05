import { resolveFribbTmdbMapping } from "@/lib/fribb-mapping";
import { describe, expect, it } from "vitest";

describe("resolveFribbTmdbMapping", () => {
  it("prefers movie when AniList format is MOVIE and both IDs exist", () => {
    expect(resolveFribbTmdbMapping({ tv: 100, movie: 200 }, "MOVIE")).toEqual({
      id: 200,
      type: "movie",
    });
  });

  it("prefers TV for non-movie formats when both IDs exist", () => {
    expect(resolveFribbTmdbMapping({ tv: 100, movie: 200 }, "TV")).toEqual({
      id: 100,
      type: "tv",
    });
  });

  it("falls back to movie when only movie ID exists", () => {
    expect(resolveFribbTmdbMapping({ movie: 42 }, "TV")).toEqual({
      id: 42,
      type: "movie",
    });
  });

  it("returns null when no mapping exists", () => {
    expect(resolveFribbTmdbMapping(undefined, "TV")).toBeNull();
    expect(resolveFribbTmdbMapping({}, "MOVIE")).toBeNull();
  });
});
