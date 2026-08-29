import { describe, expect, it } from "vitest";

import {
  isLatestAiredEpisode,
  tvCompleteFieldsFromDetail,
  watchlistStatusAfterComplete,
  type ContinueWatchingCompleteMedia,
} from "@/lib/playback/continue-watching-complete";

const latestTv = (
  overrides: Partial<ContinueWatchingCompleteMedia> = {},
): ContinueWatchingCompleteMedia => ({
  mediaType: "tv",
  seasonNumber: 2,
  episodeNumber: 10,
  lastAiredSeason: 2,
  lastAiredEpisode: 10,
  ...overrides,
});

describe("watchlistStatusAfterComplete", () => {
  it("marks a movie as completed", () => {
    expect(watchlistStatusAfterComplete({ mediaType: "movie" })).toBe(
      "completed",
    );
  });

  it("returns null for mid-season tv so the card hides without changing status", () => {
    expect(
      watchlistStatusAfterComplete(
        latestTv({
          seasonNumber: 1,
          episodeNumber: 3,
          lastAiredSeason: 1,
          lastAiredEpisode: 10,
        }),
      ),
    ).toBeNull();
  });

  it("marks last aired + Ended as completed", () => {
    expect(
      watchlistStatusAfterComplete(latestTv({ showStatus: "Ended" })),
    ).toBe("completed");
  });

  it("marks last aired + Canceled as completed", () => {
    expect(
      watchlistStatusAfterComplete(latestTv({ showStatus: "  Canceled  " })),
    ).toBe("completed");
  });

  it("returns null (caught up, stays watching) for last aired + Returning Series", () => {
    expect(
      watchlistStatusAfterComplete(
        latestTv({ showStatus: "Returning Series" }),
      ),
    ).toBeNull();
  });

  it("returns null (caught up, stays watching) for last aired + hasNextEpisode", () => {
    expect(
      watchlistStatusAfterComplete(
        latestTv({ hasNextEpisode: true, showStatus: "Pilot" }),
      ),
    ).toBeNull();
  });

  it("marks last aired + Ended as completed even if hasNextEpisode is true", () => {
    expect(
      watchlistStatusAfterComplete(
        latestTv({ showStatus: "ended", hasNextEpisode: true }),
      ),
    ).toBe("completed");
  });

  it("returns null when episode numbers are missing", () => {
    expect(
      watchlistStatusAfterComplete({
        mediaType: "tv",
        seasonNumber: 1,
        lastAiredSeason: 1,
        lastAiredEpisode: 8,
      }),
    ).toBeNull();
  });

  it("treats season 2 episode 10 as a match against last aired 2x10, but stays watching (caught up)", () => {
    const media = latestTv();
    expect(isLatestAiredEpisode(media)).toBe(true);
    expect(watchlistStatusAfterComplete(media)).toBeNull();
  });

  it("returns null for a season 1 finale when last aired is season 5 episode 1", () => {
    expect(
      watchlistStatusAfterComplete({
        mediaType: "tv",
        seasonNumber: 1,
        episodeNumber: 10,
        lastAiredSeason: 5,
        lastAiredEpisode: 1,
        showStatus: "Ended",
      }),
    ).toBeNull();
  });
});

describe("tvCompleteFieldsFromDetail", () => {
  it("reads last aired episode, status, and next episode", () => {
    expect(
      tvCompleteFieldsFromDetail({
        status: "Returning Series",
        last_episode_to_air: { season_number: 3, episode_number: 8 },
        next_episode_to_air: { season_number: 3, episode_number: 9 },
      }),
    ).toEqual({
      lastAiredSeason: 3,
      lastAiredEpisode: 8,
      showStatus: "Returning Series",
      hasNextEpisode: true,
    });
  });

  it("treats a missing next episode as caught-up", () => {
    expect(
      tvCompleteFieldsFromDetail({
        status: "Ended",
        last_episode_to_air: { season_number: 8, episode_number: 6 },
        next_episode_to_air: null,
      }),
    ).toEqual({
      lastAiredSeason: 8,
      lastAiredEpisode: 6,
      showStatus: "Ended",
      hasNextEpisode: false,
    });
  });
});

describe("isLatestAiredEpisode", () => {
  it("is false when any of the four episode numbers is missing", () => {
    expect(
      isLatestAiredEpisode({
        mediaType: "tv",
        seasonNumber: 1,
        episodeNumber: 1,
        lastAiredSeason: 1,
      }),
    ).toBe(false);
  });
});
