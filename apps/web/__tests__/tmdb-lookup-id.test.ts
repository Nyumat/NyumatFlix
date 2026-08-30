import {
  buildTmdbAnimeDetailHref,
  unwrapTmdbLookupId,
} from "@/lib/tmdb-anime-route-id";
import { describe, expect, it } from "vitest";

describe("unwrapTmdbLookupId", () => {
  it("strips tmdb- anime route slugs for TMDB API lookups", () => {
    expect(unwrapTmdbLookupId("tmdb-46153")).toBe("46153");
    expect(unwrapTmdbLookupId("tmdb-movie-372058")).toBe("372058");
    expect(unwrapTmdbLookupId("196187")).toBe("196187");
  });

  it("builds anime catalog hrefs for TMDB ids", () => {
    expect(buildTmdbAnimeDetailHref(46153)).toBe("/anime/tmdb-46153");
  });
});
