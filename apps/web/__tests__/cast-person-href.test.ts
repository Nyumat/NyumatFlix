import { resolveCastPersonHref } from "@/lib/cast-person-href";
import { describe, expect, it } from "vitest";

describe("resolveCastPersonHref", () => {
  it("keeps TMDB people on /person", () => {
    expect(
      resolveCastPersonHref({
        id: 31,
        profile_path: "/abc.jpg",
      }),
    ).toBe("/person/31");
  });

  it("does not send AniList character ids to TMDB person pages", () => {
    expect(
      resolveCastPersonHref({
        id: 281763,
        profile_path:
          "https://s4.anilist.co/file/anilistcdn/character/large/b281763.jpg",
      }),
    ).toBeNull();
  });

  it("honors an explicit null href from AniList cast mapping", () => {
    expect(
      resolveCastPersonHref({
        id: 281763,
        href: null,
        profile_path: "/abc.jpg",
      }),
    ).toBeNull();
  });
});
