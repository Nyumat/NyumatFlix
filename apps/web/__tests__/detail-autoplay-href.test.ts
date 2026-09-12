import { describe, expect, it } from "vitest";

import type { WatchlistItem } from "@/lib/domain/watchlist";
import {
  appendAutoplayParam,
  buildDetailPlayHref,
} from "@/lib/playback/detail-autoplay-href";

const watchlistItem = (): WatchlistItem => ({
  id: "wl-1",
  userId: "user-1",
  contentId: 1399,
  mediaType: "tv",
  status: "plan_to_watch",
  lastWatchedSeason: null,
  lastWatchedEpisode: null,
  lastWatchedAt: null,
  dismissedAt: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
});

describe("detail autoplay href", () => {
  it("appends autoplay for movies", () => {
    expect(buildDetailPlayHref("/movies/123", { mediaType: "movie" })).toBe(
      "/movies/123?autoplay=true",
    );
  });

  it("skips autoplay for cold tv visits", () => {
    expect(buildDetailPlayHref("/tvshows/1399", { mediaType: "tv" })).toBe(
      "/tvshows/1399",
    );
  });

  it("keeps autoplay for tv shows on the watchlist", () => {
    expect(
      buildDetailPlayHref("/tvshows/1399", {
        mediaType: "tv",
        watchlistItem: watchlistItem(),
      }),
    ).toBe("/tvshows/1399?autoplay=true");
  });

  it("keeps autoplay for tv shows with local progress", () => {
    expect(
      buildDetailPlayHref("/tvshows/1399", {
        mediaType: "tv",
        localCoords: { seasonNumber: 1, episodeNumber: 3 },
      }),
    ).toBe("/tvshows/1399?autoplay=true");
  });

  it("preserves existing query params when appending autoplay", () => {
    expect(appendAutoplayParam("/tvshows/1399?season=2")).toBe(
      "/tvshows/1399?season=2&autoplay=true",
    );
  });
});
