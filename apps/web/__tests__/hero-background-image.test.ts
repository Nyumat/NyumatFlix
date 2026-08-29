import {
  hasDistinctBackdrop,
  resolveHeroBackgroundImage,
} from "@/lib/hero-background-image";
import type { MediaItem } from "@/lib/domain/typings";
import { describe, expect, it } from "vitest";

const baseMedia = {
  id: 1,
  media_type: "tv" as const,
  name: "Test Show",
} as MediaItem;

describe("resolveHeroBackgroundImage", () => {
  it("prefers a distinct TMDB backdrop even on AniList routes", () => {
    const media = {
      ...baseMedia,
      poster_path: "/poster.jpg",
      backdrop_path: "/backdrop.jpg",
    } as MediaItem;

    const resolved = resolveHeroBackgroundImage(media, {
      preferPosterWhenNoBackdrop: true,
    });

    expect(resolved).toEqual({ path: "/backdrop.jpg", kind: "backdrop" });
  });

  it("uses poster art when backdrop is missing or duplicates poster", () => {
    const media = {
      ...baseMedia,
      poster_path: "/poster.jpg",
      backdrop_path: "/poster.jpg",
    } as MediaItem;

    const resolved = resolveHeroBackgroundImage(media, {
      preferPosterWhenNoBackdrop: true,
    });

    expect(resolved).toEqual({ path: "/poster.jpg", kind: "poster" });
  });

  it("falls back to episode still when no poster or backdrop exists", () => {
    const media = {
      ...baseMedia,
      poster_path: null,
      backdrop_path: null,
    } as MediaItem;

    const resolved = resolveHeroBackgroundImage(media, {
      preferPosterWhenNoBackdrop: true,
      episodeStillPath: "/still.jpg",
    });

    expect(resolved).toEqual({ path: "/still.jpg", kind: "still" });
  });
});

describe("hasDistinctBackdrop", () => {
  it("detects when backdrop and poster differ", () => {
    expect(hasDistinctBackdrop("/a.jpg", "/b.jpg")).toBe(true);
    expect(hasDistinctBackdrop("/a.jpg", "/a.jpg")).toBe(false);
  });
});
