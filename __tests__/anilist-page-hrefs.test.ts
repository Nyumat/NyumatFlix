import { withAnimePageHref } from "@/lib/anilist-page-hrefs";
import type { MediaItem } from "@/lib/domain/typings";
import { describe, expect, it } from "vitest";

describe("withAnimePageHref", () => {
  it("routes mapped items to internal detail pages", () => {
    expect(
      withAnimePageHref({
        id: 42,
        media_type: "tv",
        href: "https://anilist.co/anime/1",
      } as unknown as MediaItem).href,
    ).toBe("/tvshows/42");
  });

  it("sends unmapped fallback items to internal search", () => {
    expect(
      withAnimePageHref({
        id: 1,
        media_type: "tv",
        name: "Cowboy Bebop",
        isAniListFallback: true,
        href: "https://anilist.co/anime/1",
      } as unknown as MediaItem).href,
    ).toBe("/search?q=Cowboy%20Bebop");
  });

  it("preserves existing internal hrefs", () => {
    expect(
      withAnimePageHref({
        id: 42,
        media_type: "tv",
        href: "/tvshows/42",
      } as unknown as MediaItem).href,
    ).toBe("/tvshows/42");
  });
});
