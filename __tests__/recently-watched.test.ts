import { describe, expect, it } from "vitest";

import type { WatchlistItem } from "@/lib/domain/watchlist";
import {
  buildRecentlyWatchedHref,
  collectRecentlyWatchedStubs,
  matchesRecentlyWatchedScope,
  toRecentlyWatchedItem,
} from "@/lib/playback/recently-watched";
import {
  listPlaybackProgress,
  parseProgressStorageKey,
  playbackProgressRatio,
  PLAYBACK_PROGRESS_STORAGE_KEY,
  setPlaybackProgress,
} from "@/lib/playback/progress-storage";

describe("parseProgressStorageKey", () => {
  it("parses movie and tv keys", () => {
    expect(parseProgressStorageKey("movie:550::")).toEqual({
      mediaType: "movie",
      contentId: 550,
    });
    expect(parseProgressStorageKey("tv:1399:1:3")).toEqual({
      mediaType: "tv",
      contentId: 1399,
      seasonNumber: 1,
      episodeNumber: 3,
    });
  });

  it("rejects invalid keys", () => {
    expect(parseProgressStorageKey("bad")).toBeNull();
    expect(parseProgressStorageKey("movie:abc::")).toBeNull();
  });
});

describe("listPlaybackProgress", () => {
  it("lists saved entries newest first", () => {
    window.localStorage.removeItem(PLAYBACK_PROGRESS_STORAGE_KEY);

    setPlaybackProgress(
      { mediaType: "movie", contentId: 1 },
      { watched: 100, duration: 1000 },
    );
    setPlaybackProgress(
      { mediaType: "tv", contentId: 2, seasonNumber: 1, episodeNumber: 1 },
      { watched: 200, duration: 2000 },
    );

    const listed = listPlaybackProgress();
    expect(listed).toHaveLength(2);
    expect(listed[0]?.updatedAt).toBeGreaterThanOrEqual(
      listed[1]?.updatedAt ?? 0,
    );
    expect(playbackProgressRatio({ watched: 250, duration: 1000 })).toBe(0.25);
  });
});

describe("collectRecentlyWatchedStubs", () => {
  it("merges playback, vidsrc, and watchlist by title", () => {
    const watchlist: WatchlistItem[] = [
      {
        id: "w1",
        userId: "u1",
        contentId: 550,
        mediaType: "movie",
        status: "watching",
        lastWatchedSeason: null,
        lastWatchedEpisode: null,
        lastWatchedAt: new Date("2026-07-01T12:00:00.000Z"),
        createdAt: new Date("2026-06-01T12:00:00.000Z"),
        updatedAt: new Date("2026-07-01T12:00:00.000Z"),
      },
    ];

    const stubs = collectRecentlyWatchedStubs({
      playback: [
        {
          mediaType: "movie",
          contentId: 550,
          watched: 400,
          duration: 1000,
          updatedAt: Date.parse("2026-07-02T12:00:00.000Z"),
          storageKey: "movie:550::",
        },
        {
          mediaType: "tv",
          contentId: 1399,
          seasonNumber: 2,
          episodeNumber: 4,
          watched: 600,
          duration: 2400,
          updatedAt: Date.parse("2026-07-03T12:00:00.000Z"),
          storageKey: "tv:1399:2:4",
        },
      ],
      vidsrc: [
        {
          id: "550",
          type: "movie",
          title: "Fight Club",
          backdrop_path: "/backdrop.jpg",
          progress: { watched: 400, duration: 1000 },
          last_updated: Date.parse("2026-07-02T12:00:00.000Z"),
        },
      ],
      watchlist,
      limit: 10,
    });

    expect(stubs).toHaveLength(2);
    expect(stubs[0]?.contentId).toBe(1399);
    expect(stubs[0]?.seasonNumber).toBe(2);
    expect(stubs[1]?.contentId).toBe(550);
    expect(stubs[1]?.title).toBe("Fight Club");
    expect(stubs[1]?.progressRatio).toBe(0.4);
    expect(stubs[1]?.backdropPath).toBe("/backdrop.jpg");
  });

  it("drops finished movies", () => {
    const stubs = collectRecentlyWatchedStubs({
      playback: [
        {
          mediaType: "movie",
          contentId: 1,
          watched: 5900,
          duration: 6000,
          updatedAt: 100,
          storageKey: "movie:1::",
        },
      ],
      limit: 10,
    });

    expect(stubs).toHaveLength(0);
  });

  it("builds item hrefs and titles", () => {
    expect(buildRecentlyWatchedHref("movie", 1)).toBe("/movies/1");
    expect(buildRecentlyWatchedHref("tv", 2, 3)).toBe("/tvshows/2?season=3");

    const item = toRecentlyWatchedItem(
      {
        mediaType: "tv",
        contentId: 1399,
        seasonNumber: 1,
        episodeNumber: 2,
        progressRatio: 0.5,
        updatedAt: 1,
      },
      { title: "Game of Thrones", backdropPath: "/b.jpg", year: "2011" },
    );

    expect(item.href).toBe("/tvshows/1399?season=1");
    expect(item.title).toBe("Game of Thrones");
    expect(item.year).toBe("2011");
    expect(item.isAnime).toBe(false);
  });

  it("filters stubs by media type", () => {
    const stubs = collectRecentlyWatchedStubs({
      playback: [
        {
          mediaType: "movie",
          contentId: 1,
          watched: 100,
          duration: 1000,
          updatedAt: 2,
          storageKey: "movie:1::",
        },
        {
          mediaType: "tv",
          contentId: 2,
          seasonNumber: 1,
          episodeNumber: 1,
          watched: 100,
          duration: 1000,
          updatedAt: 3,
          storageKey: "tv:2:1:1",
        },
      ],
      mediaTypes: ["movie"],
      limit: 10,
    });

    expect(stubs).toHaveLength(1);
    expect(stubs[0]?.mediaType).toBe("movie");
  });
});

describe("matchesRecentlyWatchedScope", () => {
  it("scopes movie, tv, and anime correctly", () => {
    expect(
      matchesRecentlyWatchedScope(
        { mediaType: "movie", isAnime: false },
        "movie",
      ),
    ).toBe(true);
    expect(
      matchesRecentlyWatchedScope({ mediaType: "tv", isAnime: true }, "movie"),
    ).toBe(false);
    expect(
      matchesRecentlyWatchedScope({ mediaType: "tv", isAnime: false }, "tv"),
    ).toBe(true);
    expect(
      matchesRecentlyWatchedScope({ mediaType: "tv", isAnime: true }, "tv"),
    ).toBe(false);
    expect(
      matchesRecentlyWatchedScope({ mediaType: "tv", isAnime: true }, "anime"),
    ).toBe(true);
    expect(
      matchesRecentlyWatchedScope(
        { mediaType: "movie", isAnime: true },
        "anime",
      ),
    ).toBe(true);
  });
});
