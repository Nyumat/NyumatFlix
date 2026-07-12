import { withAnimePageHref } from "@/lib/anilist-page-hrefs";
import type { MediaItem } from "@/lib/domain/typings";
import { describe, expect, it } from "vitest";

describe("withAnimePageHref", () => {
  it("routes mapped items to internal detail pages with anilistId", () => {
    expect(
      withAnimePageHref({
        id: 42,
        media_type: "tv",
        sourceAnilistId: 101922,
        href: "https://anilist.co/anime/1",
      } as unknown as MediaItem).href,
    ).toBe("/tvshows/42?anilistId=101922");
  });

  it("routes unmapped AniList fallback items to AniList-backed TV detail pages", () => {
    expect(
      withAnimePageHref({
        id: 188,
        media_type: "tv",
        name: "Gosenzo San'e",
        isAniListFallback: true,
        sourceAnilistId: 188,
        href: "https://anilist.co/anime/188",
      } as unknown as MediaItem).href,
    ).toBe("/tvshows/anilist-188");
  });

  it("preserves existing internal hrefs and appends anilistId when known", () => {
    expect(
      withAnimePageHref({
        id: 42,
        media_type: "tv",
        sourceAnilistId: 7,
        href: "/tvshows/42",
      } as unknown as MediaItem).href,
    ).toBe("/tvshows/42?anilistId=7");
  });

  it("leaves mapped hrefs alone when sourceAnilistId is missing", () => {
    expect(
      withAnimePageHref({
        id: 42,
        media_type: "tv",
        href: "/tvshows/42",
      } as unknown as MediaItem).href,
    ).toBe("/tvshows/42");
  });
});
