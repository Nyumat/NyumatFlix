import { resolveTvCardHref } from "@/lib/tv-card-href";
import { describe, expect, it } from "vitest";

describe("resolveTvCardHref", () => {
  it("prefers an existing internal href", () => {
    expect(
      resolveTvCardHref({
        id: 188,
        href: "/anime/188",
        poster_path: "/tmdb.jpg",
      }),
    ).toBe("/anime/anilist-188");
  });

  it("routes AniList posters to /anime/{id}", () => {
    expect(
      resolveTvCardHref({
        id: 21087,
        poster_path:
          "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21087.jpg",
      }),
    ).toBe("/anime/anilist-21087");
  });

  it("keeps TMDB cards on /tvshows outside the anime catalog", () => {
    expect(
      resolveTvCardHref({
        id: 1396,
        poster_path: "/abc.jpg",
      }),
    ).toBe("/tvshows/1396");
  });

  it("uses the TMDB anime slug on anime catalog when the id is not AniList", () => {
    expect(
      resolveTvCardHref(
        {
          id: 1396,
          poster_path: "/abc.jpg",
        },
        "anime",
      ),
    ).toBe("/anime/tmdb-1396");
  });
});
