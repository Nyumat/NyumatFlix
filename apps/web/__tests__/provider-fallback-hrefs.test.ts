import { withAnimePageHref } from "@/lib/anilist-page-hrefs";
import type { MediaItem } from "@/lib/domain/typings";
import { describe, expect, it } from "vitest";

describe("provider fallback hrefs", () => {
  it("routes Kitsu sentinel items to kitsu detail slugs", () => {
    expect(
      withAnimePageHref({
        id: -2_000_046_474,
        media_type: "tv",
        isAniListFallback: true,
      } as unknown as MediaItem).href,
    ).toBe("/anime/kitsu-46474");
  });

  it("routes Jikan sentinel items to mal detail slugs", () => {
    expect(
      withAnimePageHref({
        id: -2_100_052_991,
        media_type: "tv",
        isAniListFallback: true,
      } as unknown as MediaItem).href,
    ).toBe("/anime/mal-52991");
  });

  it("still prefers canonical AniList ids from provider mappings", () => {
    expect(
      withAnimePageHref({
        id: 154587,
        media_type: "tv",
        sourceAnilistId: 154587,
      } as unknown as MediaItem).href,
    ).toBe("/anime/anilist-154587");
  });
});
