import { describe, expect, it } from "vitest";

import type { IndexFeatureHeroItem } from "@/components/catalog/index-feature-hero";
import type { HeroBackdropOverrideEntry } from "@/lib/flags/hero-backdrop-overrides";
import {
  canAddFeaturedPinForHub,
  featuredPinCountForHub,
  HERO_FEATURED_MAX_ITEMS,
  mergeFeaturedHeroItems,
  reorderHeroBackdropOverride,
  selectFeaturedEntriesForHub,
} from "@/lib/flags/hero-featured-items";

const entry = (
  overrides: Partial<HeroBackdropOverrideEntry> = {},
): HeroBackdropOverrideEntry => ({
  key: "movie:1",
  mediaType: "movie",
  title: "Movie One",
  tmdbId: 1,
  anilistId: null,
  malId: null,
  path: "/one.jpg",
  source: "tmdb",
  label: "TMDB",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const heroItem = (
  overrides: Partial<IndexFeatureHeroItem> = {},
): IndexFeatureHeroItem =>
  ({
    id: 1,
    title: "Movie One",
    media_type: "movie",
    backdrop_path: "/auto.jpg",
    ...overrides,
  }) as IndexFeatureHeroItem;

describe("hero featured items", () => {
  it("scopes hub entries by media type", () => {
    const config = {
      version: 1 as const,
      entries: [
        entry({ key: "movie:1", mediaType: "movie", tmdbId: 1 }),
        entry({
          key: "tv:2",
          mediaType: "tv",
          title: "Show",
          tmdbId: 2,
        }),
        entry({
          key: "anime:3",
          mediaType: "anime",
          title: "Anime",
          tmdbId: null,
          anilistId: 3,
        }),
      ],
    };

    expect(
      selectFeaturedEntriesForHub(config, "movie").map((item) => item.key),
    ).toEqual(["movie:1"]);
    expect(
      selectFeaturedEntriesForHub(config, "tv").map((item) => item.key),
    ).toEqual(["tv:2"]);
    expect(
      selectFeaturedEntriesForHub(config, "anime").map((item) => item.key),
    ).toEqual(["anime:3"]);
  });

  it("prepends pinned items ahead of automatic lineup", () => {
    const pinned = [heroItem({ id: 99, title: "Pinned" })];
    const automatic = [
      heroItem({ id: 1, title: "Auto One" }),
      heroItem({ id: 2, title: "Auto Two" }),
    ];

    const merged = mergeFeaturedHeroItems(pinned, automatic);
    expect(merged.map((item) => item.id)).toEqual([99, 1, 2]);
  });

  it("dedupes automatic items that match pinned identities", () => {
    const pinned = [heroItem({ id: 1, title: "Pinned" })];
    const automatic = [
      heroItem({ id: 1, title: "Auto duplicate" }),
      heroItem({ id: 2, title: "Auto Two" }),
    ];

    const merged = mergeFeaturedHeroItems(pinned, automatic);
    expect(merged.map((item) => item.id)).toEqual([1, 2]);
    expect(merged[0]?.title).toBe("Pinned");
  });

  it("caps merged hero items at five", () => {
    const pinned = Array.from({ length: 3 }, (_, index) =>
      heroItem({ id: 100 + index, title: `Pin ${index}` }),
    );
    const automatic = Array.from({ length: 5 }, (_, index) =>
      heroItem({ id: 200 + index, title: `Auto ${index}` }),
    );

    const merged = mergeFeaturedHeroItems(pinned, automatic);
    expect(merged).toHaveLength(HERO_FEATURED_MAX_ITEMS);
    expect(merged.map((item) => item.id)).toEqual([100, 101, 102, 200, 201]);
  });

  it("tracks per-hub pin counts and cap", () => {
    const config = {
      version: 1 as const,
      entries: Array.from({ length: 5 }, (_, index) =>
        entry({
          key: `anime:${index}`,
          mediaType: "anime",
          title: `Anime ${index}`,
          tmdbId: null,
          anilistId: index + 1,
        }),
      ),
    };

    expect(featuredPinCountForHub(config, "anime")).toBe(5);
    expect(canAddFeaturedPinForHub(config, "anime")).toBe(false);
    expect(featuredPinCountForHub(config, "tv")).toBe(0);
    expect(canAddFeaturedPinForHub(config, "tv")).toBe(true);
  });

  it("reorders override entries", () => {
    const config = {
      version: 1 as const,
      entries: [
        entry({ key: "movie:1", tmdbId: 1 }),
        entry({ key: "movie:2", tmdbId: 2, title: "Two" }),
      ],
    };

    const movedDown = reorderHeroBackdropOverride(config, "movie:1", "down");
    expect(movedDown.entries.map((item) => item.key)).toEqual([
      "movie:2",
      "movie:1",
    ]);

    const movedUp = reorderHeroBackdropOverride(movedDown, "movie:1", "up");
    expect(movedUp.entries.map((item) => item.key)).toEqual([
      "movie:1",
      "movie:2",
    ]);
  });

  it("reorders within the same media type only", () => {
    const config = {
      version: 1 as const,
      entries: [
        entry({ key: "movie:1", tmdbId: 1 }),
        entry({
          key: "anime:3",
          mediaType: "anime",
          title: "Anime",
          tmdbId: null,
          anilistId: 3,
        }),
        entry({ key: "movie:2", tmdbId: 2, title: "Two" }),
      ],
    };

    const moved = reorderHeroBackdropOverride(config, "movie:2", "up");
    expect(moved.entries.map((item) => item.key)).toEqual([
      "movie:2",
      "anime:3",
      "movie:1",
    ]);
  });
});
