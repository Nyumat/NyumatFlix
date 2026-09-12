import { describe, expect, it } from "vitest";

import {
  isPlaceholderEpisodeName,
  resolveEpisodeThumbnailUrl,
} from "@/lib/anime/episode-thumbnail-url";

describe("isPlaceholderEpisodeName", () => {
  it("treats numbered episode labels as placeholders", () => {
    expect(isPlaceholderEpisodeName("Episode 1")).toBe(true);
    expect(isPlaceholderEpisodeName("Ep. 12")).toBe(true);
    expect(isPlaceholderEpisodeName("episode 01")).toBe(true);
    expect(isPlaceholderEpisodeName("To You, in 2000 Years")).toBe(false);
  });
});

describe("resolveEpisodeThumbnailUrl", () => {
  const tmdbImageUrl = (path: string, size: string) => `${size}:${path}`;

  it("prefers unique stills over kitsu and series art", () => {
    expect(
      resolveEpisodeThumbnailUrl({
        stillPath: "/ep-1.jpg",
        kitsuUrl: "https://media.kitsu.app/ep1.jpg",
        fallbackPosterPath: "/poster.jpg",
        fallbackBackdropPath: "/backdrop.jpg",
        tmdbImageUrl,
      }),
    ).toBe("w300:/ep-1.jpg");
  });

  it("skips stills that repeat the series poster or backdrop", () => {
    expect(
      resolveEpisodeThumbnailUrl({
        stillPath: "/poster.jpg",
        kitsuUrl: "https://media.kitsu.app/ep1.jpg",
        fallbackPosterPath: "/poster.jpg",
        fallbackBackdropPath: "/backdrop.jpg",
        tmdbImageUrl,
      }),
    ).toBe("https://media.kitsu.app/ep1.jpg");

    expect(
      resolveEpisodeThumbnailUrl({
        stillPath: "/backdrop.jpg",
        kitsuUrl: "https://media.kitsu.app/ep2.jpg",
        fallbackPosterPath: "/poster.jpg",
        fallbackBackdropPath: "/backdrop.jpg",
        tmdbImageUrl,
      }),
    ).toBe("https://media.kitsu.app/ep2.jpg");
  });
});
