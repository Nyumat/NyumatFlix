import { describe, expect, it, beforeEach } from "vitest";
import { resolveInitialWatchlistStatus } from "@/lib/watchlist/resolve-initial-watchlist-status";
import { setPlaybackProgress } from "@/lib/playback/progress-storage";
import { resetGuestLedger } from "@/lib/playback/progress-ledger-facade";

describe("resolveInitialWatchlistStatus", () => {
  beforeEach(() => {
    resetGuestLedger();
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
    setPlaybackProgress(
      { mediaType: "movie", contentId: 100 },
      { watched: 1200, duration: 7200 },
    );

    const res = resolveInitialWatchlistStatus({
      contentId: 100,
      mediaType: "movie",
    });

    expect(res.status).toBe("watching");
    expect(res.label).toBe("Saved to Watching");
  });

  it("returns 'completed' for completed movie", () => {
    setPlaybackProgress(
      { mediaType: "movie", contentId: 100 },
      { watched: 7150, duration: 7200 },
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
    setPlaybackProgress(
      {
        mediaType: "tv",
        contentId: 200,
        seasonNumber: 2,
        episodeNumber: 4,
      },
      { watched: 800, duration: 1500 },
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
