import { describe, expect, it } from "vitest";

import {
  DEFAULT_HERO_BACKDROP_OVERRIDES,
  findHeroBackdropOverride,
  heroBackdropOverrideKey,
  heroBackdropPreviewUrl,
  isAllowedHeroBackdropPath,
  patchHeroBackdropOverride,
  removeHeroBackdropOverride,
  sanitizeHeroBackdropOverridesConfig,
  upsertHeroBackdropOverride,
  withHeroBackdropOverride,
  type HeroBackdropOverrideEntry,
} from "@/lib/flags/hero-backdrop-overrides";

const entry = (
  overrides: Partial<HeroBackdropOverrideEntry> = {},
): HeroBackdropOverrideEntry => ({
  key: "movie:969681",
  mediaType: "movie",
  title: "Spider-Man: Brand New Day",
  tmdbId: 969681,
  anilistId: null,
  malId: null,
  path: "/spidey.jpg",
  source: "tmdb",
  label: "TMDB · 1920×1080 · Textless",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("hero backdrop overrides", () => {
  it("accepts tmdb paths and https urls, rejects junk", () => {
    expect(isAllowedHeroBackdropPath("/abc.jpg")).toBe(true);
    expect(isAllowedHeroBackdropPath("https://example.com/a.jpg")).toBe(true);
    expect(isAllowedHeroBackdropPath("//evil.com/a.jpg")).toBe(false);
    expect(isAllowedHeroBackdropPath("javascript:alert(1)")).toBe(false);
    expect(isAllowedHeroBackdropPath("not a path")).toBe(false);
    expect(isAllowedHeroBackdropPath("")).toBe(false);
  });

  it("builds preview urls for tmdb paths and raw urls", () => {
    expect(heroBackdropPreviewUrl("/abc.jpg", "w780")).toBe(
      "https://image.tmdb.org/t/p/w780/abc.jpg",
    );
    expect(heroBackdropPreviewUrl("https://cdn.example.com/a.jpg")).toBe(
      "https://cdn.example.com/a.jpg",
    );
  });

  it("sanitizes entries and drops invalid ones", () => {
    const config = sanitizeHeroBackdropOverridesConfig({
      entries: [
        entry(),
        entry({ key: "bad", path: "javascript:alert(1)" }),
        entry({
          key: "anime:1",
          mediaType: "anime",
          tmdbId: null,
          anilistId: 1,
        }),
      ],
    });

    expect(config.entries).toHaveLength(2);
    expect(config.entries.map((item) => item.key)).toEqual([
      "movie:969681",
      "anime:1",
    ]);
  });

  it("returns defaults for garbage input", () => {
    expect(sanitizeHeroBackdropOverridesConfig(null)).toEqual(
      DEFAULT_HERO_BACKDROP_OVERRIDES,
    );
    expect(sanitizeHeroBackdropOverridesConfig({ entries: "nope" })).toEqual(
      DEFAULT_HERO_BACKDROP_OVERRIDES,
    );
  });

  it("matches by tmdb, then anilist, then mal", () => {
    const config = sanitizeHeroBackdropOverridesConfig({
      entries: [
        entry({
          key: "anime:1735",
          mediaType: "anime",
          tmdbId: null,
          anilistId: 1735,
        }),
        entry(),
      ],
    });

    expect(
      findHeroBackdropOverride(config, { mediaType: "movie", tmdbId: 969681 })
        ?.key,
    ).toBe("movie:969681");
    expect(
      findHeroBackdropOverride(config, { mediaType: "anime", anilistId: 1735 })
        ?.key,
    ).toBe("anime:1735");
    expect(findHeroBackdropOverride(config, { tmdbId: 1 })).toBeNull();
  });

  it("upserts by key and by overlapping ids", () => {
    const base = sanitizeHeroBackdropOverridesConfig({ entries: [entry()] });
    const replaced = upsertHeroBackdropOverride(
      base,
      entry({ key: "movie:abc", path: "/new.jpg" }),
    );
    expect(replaced.entries).toHaveLength(1);
    expect(replaced.entries[0]?.path).toBe("/new.jpg");

    const withAnime = upsertHeroBackdropOverride(
      replaced,
      entry({
        key: "anime:1735",
        mediaType: "anime",
        tmdbId: null,
        anilistId: 1735,
      }),
    );
    expect(withAnime.entries).toHaveLength(2);

    const removed = removeHeroBackdropOverride(withAnime, "movie:abc");
    expect(removed.entries.map((item) => item.key)).toEqual(["anime:1735"]);
  });

  it("patches a backdrop in place without reordering pins", () => {
    const config = sanitizeHeroBackdropOverridesConfig({
      entries: [
        entry(),
        entry({
          key: "tv:1",
          mediaType: "tv",
          title: "Severance",
          tmdbId: 1,
          path: "/sev.jpg",
        }),
      ],
    });

    const next = patchHeroBackdropOverride(config, "movie:969681", {
      path: "/other.jpg",
      source: "anilist",
      label: "AniList · banner",
    });

    expect(next.entries.map((item) => item.key)).toEqual([
      "movie:969681",
      "tv:1",
    ]);
    expect(next.entries[0]?.path).toBe("/other.jpg");
    expect(next.entries[0]?.label).toBe("AniList · banner");
    expect(next.entries[1]?.path).toBe("/sev.jpg");
  });

  it("allows the same tmdb id on different hub media types", () => {
    const base = sanitizeHeroBackdropOverridesConfig({ entries: [entry()] });
    const withAnime = upsertHeroBackdropOverride(
      base,
      entry({
        key: "anime:969681",
        mediaType: "anime",
        anilistId: 21698,
      }),
    );

    expect(withAnime.entries).toHaveLength(2);
    expect(withAnime.entries.map((item) => item.key)).toEqual([
      "movie:969681",
      "anime:969681",
    ]);
  });

  it("applies the override onto backdrop_path", () => {
    const item = { id: 1, backdrop_path: "/original.jpg" };
    expect(withHeroBackdropOverride(item, entry({ path: "/new.jpg" }))).toEqual(
      { id: 1, backdrop_path: "/new.jpg" },
    );
    expect(withHeroBackdropOverride(item, null)).toBe(item);
  });

  it("derives stable keys", () => {
    expect(heroBackdropOverrideKey("movie", { tmdbId: 5 })).toBe("movie:5");
    expect(heroBackdropOverrideKey("anime", { anilistId: 9 })).toBe("anime:9");
    expect(heroBackdropOverrideKey("tv", {})).toBe("tv:unknown");
  });
});
