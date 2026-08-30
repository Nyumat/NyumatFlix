import { withAnimePageHref } from "@/lib/anilist-page-hrefs";
import type { MediaItem } from "@/lib/domain/typings";
import { describe, expect, it } from "vitest";

describe("withAnimePageHref", () => {
  it("routes mapped anime catalog items through /anime anilist detail", () => {
    expect(
      withAnimePageHref({
        id: 42,
        media_type: "tv",
        sourceAnilistId: 154587,
        href: "https://anilist.co/anime/154587",
      } as unknown as MediaItem).href,
    ).toBe("/anime/anilist-154587");
  });

  it("routes unmapped AniList fallback items to AniList-backed anime detail pages", () => {
    expect(
      withAnimePageHref({
        id: 188,
        media_type: "tv",
        name: "Gosenzo San'e",
        isAniListFallback: true,
        sourceAnilistId: 188,
        href: "https://anilist.co/anime/188",
      } as unknown as MediaItem).href,
    ).toBe("/anime/anilist-188");
  });

  it("prefers /anime routes over existing internal tv detail hrefs when anilistId is known", () => {
    expect(
      withAnimePageHref({
        id: 42,
        media_type: "tv",
        sourceAnilistId: 7,
        href: "/tvshows/42",
      } as unknown as MediaItem).href,
    ).toBe("/anime/anilist-7");
  });

  it("routes mapped anime movies through TMDB movie detail pages", () => {
    expect(
      withAnimePageHref({
        id: 372058,
        media_type: "movie",
        sourceAnilistId: 21519,
        href: "/movies/372058",
      } as unknown as MediaItem).href,
    ).toBe("/movies/372058");
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
