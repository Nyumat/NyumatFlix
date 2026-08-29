import {
  isHeroBackdropWideEnough,
  isTmdbStyleBackdropPath,
  MIN_HERO_BACKDROP_ASPECT_RATIO,
} from "@/lib/hero-backdrop-aspect";
import { describe, expect, it } from "vitest";

describe("isTmdbStyleBackdropPath", () => {
  it("detects TMDB relative paths", () => {
    expect(isTmdbStyleBackdropPath("/gkmE41A5ev5M299hLgX3JrWAM16.jpg")).toBe(
      true,
    );
  });

  it("rejects external URLs", () => {
    expect(
      isTmdbStyleBackdropPath(
        "https://s4.anilist.co/file/anilistcdn/media/anime/banner/196187.jpg",
      ),
    ).toBe(false);
  });
});

describe("isHeroBackdropWideEnough", () => {
  it("accepts 16:9 backdrops", () => {
    expect(isHeroBackdropWideEnough(1920, 1080)).toBe(true);
  });

  it("rejects portrait banners", () => {
    expect(
      isHeroBackdropWideEnough(850, 1200, MIN_HERO_BACKDROP_ASPECT_RATIO),
    ).toBe(false);
  });
});
