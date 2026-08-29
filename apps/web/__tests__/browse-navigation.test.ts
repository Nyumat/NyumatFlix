import { navigation } from "@/config/site";
import { getNavigationItems } from "@/lib/navigation";
import { isInNavGroup } from "@/lib/nav/browse";
import { describe, expect, test } from "vitest";

describe("browse navigation", () => {
  test("only exposes top-level destinations", () => {
    expect(navigation.items).toEqual([
      { title: "Movies", href: "/movies" },
      { title: "TV Shows", href: "/tvshows" },
      { title: "Anime", href: "/anime" },
      { title: "People", href: "/people" },
      { title: "Trending", href: "/trending" },
    ]);
  });

  test("inserts Live TV without introducing a second menu level", () => {
    expect(getNavigationItems(true)).toEqual([
      { title: "Movies", href: "/movies" },
      { title: "TV Shows", href: "/tvshows" },
      { title: "Anime", href: "/anime" },
      { title: "Live TV", href: "/live" },
      { title: "People", href: "/people" },
      { title: "Trending", href: "/trending" },
    ]);
  });

  test("keeps deeper pages in their top-level nav group", () => {
    const people = navigation.items.find((item) => item.title === "People");
    const movies = navigation.items.find((item) => item.title === "Movies");

    expect(people).toBeDefined();
    expect(movies).toBeDefined();
    expect(isInNavGroup("/people/popular", people!)).toBe(true);
    expect(isInNavGroup("/movies/123", movies!)).toBe(true);
  });

  test("uses parent route override for anime TV detail pages", () => {
    const anime = navigation.items.find((item) => item.title === "Anime");
    const tvShows = navigation.items.find((item) => item.title === "TV Shows");

    expect(anime).toBeDefined();
    expect(tvShows).toBeDefined();
    expect(isInNavGroup("/tvshows/207840", anime!, "/anime")).toBe(true);
    expect(isInNavGroup("/tvshows/207840", tvShows!, "/anime")).toBe(false);
  });

  test("uses parent route override for anime movie detail pages", () => {
    const anime = navigation.items.find((item) => item.title === "Anime");
    const movies = navigation.items.find((item) => item.title === "Movies");

    expect(anime).toBeDefined();
    expect(movies).toBeDefined();
    expect(isInNavGroup("/movies/12345", anime!, "/anime")).toBe(true);
    expect(isInNavGroup("/movies/12345", movies!, "/anime")).toBe(false);
  });
});
