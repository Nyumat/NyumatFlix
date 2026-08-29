import { describe, expect, it } from "vitest";

import type { Episode } from "@/lib/domain/typings";
import type { WatchlistItem } from "@/lib/domain/watchlist";
import { setPlaybackProgress } from "@/lib/playback/progress-storage";
import {
  formatTvWatchLabel,
  isTvPlaybackResume,
  isTvWatchlistResume,
  resolveTvWatchTarget,
  type TvWatchTarget,
} from "@/lib/tv-watch-target";

const episode = (episodeNumber: number): Episode => ({
  id: episodeNumber,
  episode_number: episodeNumber,
  name: `Episode ${episodeNumber}`,
  overview: "",
  still_path: null,
  air_date: "",
  vote_average: 0,
  runtime: null,
});

const watchlistItem = (
  lastWatchedSeason: number,
  lastWatchedEpisode: number,
): WatchlistItem => ({
  id: "wl-1",
  userId: "user-1",
  contentId: 140_391,
  mediaType: "tv",
  status: "watching",
  lastWatchedSeason,
  lastWatchedEpisode,
  lastWatchedAt: new Date("2026-01-01"),
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
});

const selectionTarget: TvWatchTarget = {
  source: "selection",
  episode: episode(1),
  seasonNumber: 1,
};

describe("formatTvWatchLabel", () => {
  it("says Watch for a fresh episode", () => {
    expect(formatTvWatchLabel(selectionTarget)).toBe("Watch S1E1");
  });

  it("says Resume when continuing an episode", () => {
    expect(
      formatTvWatchLabel(selectionTarget, undefined, { resume: true }),
    ).toBe("Resume S1E1");
  });
});

describe("tv watch resume", () => {
  it("treats the last-watched episode as a resume target", () => {
    const target = resolveTvWatchTarget(
      140_391,
      { selectedEpisode: episode(1), tvShowId: "140391", seasonNumber: 1 },
      watchlistItem(1, 1),
    );

    expect(target).not.toBeNull();
    expect(isTvWatchlistResume(target!, watchlistItem(1, 1))).toBe(true);
  });

  it("does not treat a different episode as a resume target", () => {
    expect(isTvWatchlistResume(selectionTarget, watchlistItem(1, 3))).toBe(
      false,
    );
  });

  it("treats mid-episode playback progress as resume", () => {
    setPlaybackProgress(
      {
        mediaType: "tv",
        contentId: 140_391,
        seasonNumber: 1,
        episodeNumber: 1,
      },
      { watched: 600, duration: 1440 },
    );

    expect(isTvPlaybackResume(selectionTarget, 140_391)).toBe(true);
  });
});
