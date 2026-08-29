import { describe, expect, it } from "vitest";

import type { EpisodeInfo } from "@/lib/domain/episodes";
import type { WatchlistItem } from "@/lib/domain/watchlist";
import {
  buildUpNextHref,
  collectUpNextCandidates,
  isUpNextInboxCandidate,
} from "@/lib/personalization/up-next";
import {
  collectWatchHistoryStubs,
  WATCH_HISTORY_LIMIT,
} from "@/lib/playback/recently-watched";

const baseEpisodeInfo = (
  overrides: Partial<EpisodeInfo> = {},
): EpisodeInfo => ({
  hasNewEpisodes: false,
  newEpisodeCount: 0,
  hasUnwatchedEpisodes: true,
  unwatchedEpisodeCount: 1,
  nextUnwatchedEpisode: { seasonNumber: 2, episodeNumber: 1 },
  nextEpisodeDate: null,
  countdown: null,
  latestEpisodeAirDate: new Date("2026-08-01T00:00:00.000Z"),
  ...overrides,
});

const watchingTvItem = (
  contentId: number,
  overrides: Partial<WatchlistItem> = {},
): WatchlistItem => ({
  id: `item-${contentId}`,
  userId: "user-1",
  contentId,
  mediaType: "tv",
  status: "watching",
  lastWatchedSeason: 1,
  lastWatchedEpisode: 5,
  lastWatchedAt: new Date("2026-07-01T00:00:00.000Z"),
  createdAt: new Date("2026-06-01T00:00:00.000Z"),
  updatedAt: new Date("2026-07-01T00:00:00.000Z"),
  ...overrides,
});

describe("up next inbox helpers", () => {
  it("builds autoplay href from next unwatched coordinates", () => {
    expect(
      buildUpNextHref(1399, { seasonNumber: 2, episodeNumber: 1 }, 1, 5),
    ).toBe("/tvshows/1399?season=2&episode=1&autoplay=true");
  });

  it("falls back to the next episode after last watched progress", () => {
    expect(buildUpNextHref(1399, null, 1, 5)).toBe(
      "/tvshows/1399?season=1&episode=6&autoplay=true",
    );
  });

  it("only keeps watching tv titles with unwatched aired episodes", () => {
    const watchlist = [
      watchingTvItem(1),
      watchingTvItem(2, { status: "completed" }),
      watchingTvItem(3, { mediaType: "movie" }),
    ];

    const episodeData: Record<number, EpisodeInfo> = {
      1: baseEpisodeInfo(),
      2: baseEpisodeInfo(),
      3: baseEpisodeInfo(),
    };

    expect(isUpNextInboxCandidate(watchlist[0], episodeData[1])).toBe(true);
    expect(isUpNextInboxCandidate(watchlist[1], episodeData[2])).toBe(false);
    expect(isUpNextInboxCandidate(watchlist[2], episodeData[3])).toBe(false);

    const candidates = collectUpNextCandidates(watchlist, episodeData);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.contentId).toBe(1);
  });
});

describe("collectWatchHistoryStubs", () => {
  it("includes finished movies and non-watching watchlist rows", () => {
    const watchlist: WatchlistItem[] = [
      {
        id: "completed",
        userId: "u1",
        contentId: 2,
        mediaType: "movie",
        status: "completed",
        lastWatchedSeason: null,
        lastWatchedEpisode: null,
        lastWatchedAt: new Date("2026-07-03T12:00:00.000Z"),
        createdAt: new Date("2026-06-01T12:00:00.000Z"),
        updatedAt: new Date("2026-07-03T12:00:00.000Z"),
      },
    ];

    const stubs = collectWatchHistoryStubs({
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
      watchlist,
      limit: WATCH_HISTORY_LIMIT,
    });

    expect(stubs).toHaveLength(2);
    expect(stubs.map((stub) => stub.contentId)).toEqual([2, 1]);
  });
});
