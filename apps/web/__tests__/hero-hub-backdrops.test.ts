import { describe, expect, it } from "vitest";
import {
  buildHeroBackdropFromItem,
  buildHeroBackdropsFromItems,
  getHeroItemTitle,
} from "@/lib/hero-hub-backdrops";

describe("hero hub backdrops", () => {
  it("builds a backdrop from backdrop_path", () => {
    const backdrop = buildHeroBackdropFromItem(
      {
        title: "Spider-Man",
        backdrop_path: "/backdrop.jpg",
      },
      "movie",
      true,
    );

    expect(backdrop).toEqual({
      imageUrl: "https://image.tmdb.org/t/p/original/backdrop.jpg",
      alt: "Spider-Man",
      priority: true,
    });
  });

  it("falls back to poster_path when backdrop is missing", () => {
    const backdrop = buildHeroBackdropFromItem(
      {
        name: "Arcane",
        poster_path: "/poster.jpg",
      },
      "tv",
    );

    expect(backdrop?.imageUrl).toBe(
      "https://image.tmdb.org/t/p/original/poster.jpg",
    );
    expect(backdrop?.alt).toBe("Arcane");
  });

  it("maps carousel items to backdrop stacks", () => {
    const backdrops = buildHeroBackdropsFromItems(
      [
        { title: "One", backdrop_path: "/one.jpg" },
        { title: "Two", backdrop_path: "/two.jpg" },
      ],
      "movie",
    );

    expect(backdrops).toHaveLength(2);
    expect(backdrops[0]?.alt).toBe("One");
    expect(backdrops[1]?.alt).toBe("Two");
  });

  it("prefers tv names for tv media type titles", () => {
    expect(
      getHeroItemTitle({ name: "Severance", title: "Severance (alt)" }, "tv"),
    ).toBe("Severance");
  });
});
