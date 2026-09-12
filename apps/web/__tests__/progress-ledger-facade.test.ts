import { beforeEach, describe, expect, it } from "vitest";

import {
  clearSignedInLedger,
  readGuestLastTvEpisode,
  resetGuestLedger,
  setSignedInLedger,
} from "@/lib/playback/progress-ledger-facade";
import {
  getLatestTvPlaybackCoords,
  getRememberedLastTvEpisode,
  setPlaybackProgress,
} from "@/lib/playback/progress-storage";
import { resolveLocalTvWatchCoords } from "@/lib/tv-watch-target";

describe("progress-ledger-facade guest boundary", () => {
  beforeEach(() => {
    resetGuestLedger();
    clearSignedInLedger();
  });

  it("does not mirror signed-in tv coords into guest last-episode memory", () => {
    setSignedInLedger([]);

    setPlaybackProgress(
      {
        mediaType: "tv",
        contentId: 1399,
        seasonNumber: 2,
        episodeNumber: 4,
      },
      { watched: 400, duration: 3600 },
    );

    expect(getRememberedLastTvEpisode(1399)).toBeNull();
    expect(readGuestLastTvEpisode(1399)).toBeNull();
    expect(getLatestTvPlaybackCoords(1399)).toEqual(
      expect.objectContaining({
        seasonNumber: 2,
        episodeNumber: 4,
      }),
    );
  });

  it("remembers guest tv coords for guests", () => {
    setPlaybackProgress(
      {
        mediaType: "tv",
        contentId: 1399,
        seasonNumber: 2,
        episodeNumber: 4,
      },
      { watched: 400, duration: 3600 },
    );

    expect(getRememberedLastTvEpisode(1399)).toEqual(
      expect.objectContaining({
        seasonNumber: 2,
        episodeNumber: 4,
      }),
    );
  });

  it("clears guest coords on resetGuestLedger", () => {
    setPlaybackProgress(
      {
        mediaType: "tv",
        contentId: 1399,
        seasonNumber: 1,
        episodeNumber: 1,
      },
      { watched: 100, duration: 1000 },
    );

    resetGuestLedger();

    expect(resolveLocalTvWatchCoords(1399)).toBeNull();
  });
});
