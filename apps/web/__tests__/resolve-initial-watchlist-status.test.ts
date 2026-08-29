import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { resolveInitialWatchlistStatus } from "@/lib/watchlist/resolve-initial-watchlist-status";
import { PLAYBACK_PROGRESS_STORAGE_KEY } from "@/lib/playback/progress-storage";

describe("resolveInitialWatchlistStatus", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("returns 'plan_to_watch' for untouched movie", () => {
    const res = resolveInitialWatchlistStatus({
      contentId: 100,
      mediaType: "movie",
    });

    expect(res.status).toBe("plan_to_watch");
    expect(res.label).toBe("Saved to Plan to Watch");
  });

  it("returns 'watching' for movie in active playback", () => {
    window.localStorage.setItem(
      PLAYBACK_PROGRESS_STORAGE_KEY,
      JSON.stringify({
        "movie:100::": {
          watched: 1200,
          duration: 7200,
          updatedAt: Date.now(),
        },
      }),
    );

    const res = resolveInitialWatchlistStatus({
      contentId: 100,
      mediaType: "movie",
    });

    expect(res.status).toBe("watching");
    expect(res.label).toBe("Saved to Watching");
  });

  it("returns 'completed' for completed movie", () => {
    window.localStorage.setItem(
      PLAYBACK_PROGRESS_STORAGE_KEY,
      JSON.stringify({
        "movie:100::": {
          watched: 7150,
          duration: 7200,
          updatedAt: Date.now(),
        },
      }),
    );

    const res = resolveInitialWatchlistStatus({
      contentId: 100,
      mediaType: "movie",
    });

    expect(res.status).toBe("completed");
    expect(res.label).toBe("Saved to Completed");
  });

  it("returns 'plan_to_watch' for untouched tv show", () => {
    const res = resolveInitialWatchlistStatus({
      contentId: 200,
      mediaType: "tv",
    });

    expect(res.status).toBe("plan_to_watch");
    expect(res.label).toBe("Saved to Plan to Watch");
  });

  it("returns 'watching' with episode detail for tv show with progress", () => {
    window.localStorage.setItem(
      PLAYBACK_PROGRESS_STORAGE_KEY,
      JSON.stringify({
        "tv:200:2:4": {
          watched: 800,
          duration: 1500,
          updatedAt: Date.now(),
        },
      }),
    );

    const res = resolveInitialWatchlistStatus({
      contentId: 200,
      mediaType: "tv",
    });

    expect(res.status).toBe("watching");
    expect(res.label).toBe("Saved to Watching (S2:E4)");
    expect(res.seasonNumber).toBe(2);
    expect(res.episodeNumber).toBe(4);
  });
});
