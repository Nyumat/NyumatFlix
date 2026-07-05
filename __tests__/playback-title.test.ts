import { describe, expect, it } from "vitest";

import { formatPlaybackTitle } from "@/lib/playback/playback-title";

describe("formatPlaybackTitle", () => {
  it("returns the show title for movies", () => {
    expect(
      formatPlaybackTitle({
        showTitle: "Inception",
        mediaType: "movie",
      }),
    ).toBe("Inception");
  });

  it("includes season and episode for TV shows", () => {
    expect(
      formatPlaybackTitle({
        showTitle: "Breaking Bad",
        mediaType: "tv",
        seasonNumber: 1,
        episode: {
          id: 1,
          name: "Pilot",
          overview: "",
          episode_number: 1,
          air_date: "",
          still_path: null,
          runtime: null,
        },
      }),
    ).toBe("Breaking Bad · S1E1 · Pilot");
  });

  it("omits episode name when missing", () => {
    expect(
      formatPlaybackTitle({
        showTitle: "One Piece",
        mediaType: "tv",
        seasonNumber: 11,
        episode: {
          id: 1,
          name: "",
          overview: "",
          episode_number: 382,
          air_date: "",
          still_path: null,
          runtime: null,
        },
      }),
    ).toBe("One Piece · S11E382");
  });

  it("falls back when TV episode context is incomplete", () => {
    expect(
      formatPlaybackTitle({
        showTitle: "Severance",
        mediaType: "tv",
      }),
    ).toBe("Severance");
  });
});
