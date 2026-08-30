import { describe, expect, it, beforeEach } from "vitest";

import type { Episode } from "@/lib/domain/typings";
import type { WatchlistItem } from "@/lib/domain/watchlist";
import {
  LAST_TV_EPISODE_STORAGE_KEY,
  PLAYBACK_PROGRESS_STORAGE_KEY,
  rememberLastTvEpisode,
  setPlaybackProgress,
} from "@/lib/playback/progress-storage";
import {
  formatTvWatchLabel,
  isTvPlaybackResume,
  isTvWatchlistResume,
  resolveLocalTvWatchCoords,
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
  it("does not override an explicit season browse with saved progress", () => {
    const target = resolveTvWatchTarget(
      21,
      { selectedEpisode: null, tvShowId: "anilist-21", seasonNumber: 21 },
      null,
      null,
      null,
      { seasonNumber: 1, episodeNumber: 4 },
    );

    expect(target).toBeNull();
  });
});

describe("local last-episode memory", () => {
  beforeEach(() => {
    window.localStorage.removeItem(LAST_TV_EPISODE_STORAGE_KEY);
    window.localStorage.removeItem(PLAYBACK_PROGRESS_STORAGE_KEY);
  });

  it("resolves remembered season and episode without a watchlist row", () => {
    rememberLastTvEpisode(140_391, 2, 5);

    expect(resolveLocalTvWatchCoords(140_391)).toEqual({
      seasonNumber: 2,
      episodeNumber: 5,
    });

    const target = resolveTvWatchTarget(
      140_391,
      { selectedEpisode: null, tvShowId: null, seasonNumber: null },
      null,
      null,
      null,
      resolveLocalTvWatchCoords(140_391),
    );

    expect(target).toEqual({
      source: "progress",
      seasonNumber: 2,
      episodeNumber: 5,
    });
    expect(formatTvWatchLabel(target!, undefined, { resume: true })).toBe(
      "Resume S2E5",
    );
  });

  it("prefers this-device progress over a stale watchlist episode", () => {
    rememberLastTvEpisode(140_391, 3, 1);

    const target = resolveTvWatchTarget(
      140_391,
      { selectedEpisode: null, tvShowId: null, seasonNumber: null },
      watchlistItem(1, 2),
      null,
      null,
      resolveLocalTvWatchCoords(140_391),
    );

    expect(target).toEqual({
      source: "progress",
      seasonNumber: 3,
      episodeNumber: 1,
    });
  });
});
