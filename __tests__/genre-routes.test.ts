import { describe, expect, test } from "vitest";
import {
  buildAnimeGenreUrl,
  buildGenreBrowseUrl,
  getAniListGenreFromTmdbName,
} from "@/lib/genre-routes";

describe("genre route helpers", () => {
  test("builds movie and TV genre browse URLs", () => {
    expect(buildGenreBrowseUrl({ id: 18, name: "Drama" }, "movie")).toBe(
      "/browse/genre/18?type=movie",
    );
    expect(
      buildGenreBrowseUrl({ id: 10759, name: "Action & Adventure" }, "tv"),
    ).toBe("/browse/genre/10759?type=tv");
  });

  test("maps compatible TMDB genre names to AniList browse URLs", () => {
    expect(getAniListGenreFromTmdbName("Science Fiction")).toBe("Sci-Fi");
    expect(getAniListGenreFromTmdbName("Sci-Fi & Fantasy")).toBe("Sci-Fi");
    expect(getAniListGenreFromTmdbName("Action & Adventure")).toBe("Action");
    expect(buildAnimeGenreUrl("Action & Adventure")).toBe(
      "/anime?genres=Action&mode=results",
    );
  });

  test("falls back to the anime browse page when AniList has no matching genre", () => {
    expect(buildAnimeGenreUrl("Animation")).toBe("/anime?mode=results");
    expect(buildGenreBrowseUrl({ id: 16, name: "Animation" }, "tv", true)).toBe(
      "/anime?mode=results",
    );
  });
});
