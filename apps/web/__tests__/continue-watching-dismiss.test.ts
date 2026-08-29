import { describe, expect, it } from "vitest";

import {
  CONTINUE_WATCHING_DISMISSALS_STORAGE_KEY,
  continueWatchingTitleKey,
  dismissContinueWatchingTitle,
  filterDismissedContinueWatching,
  isContinueWatchingTitleDismissed,
  readContinueWatchingDismissals,
} from "@/lib/playback/continue-watching-dismiss";

describe("continueWatchingTitleKey", () => {
  it("formats movie and tv title keys", () => {
    expect(continueWatchingTitleKey("movie", 550)).toBe("movie:550");
    expect(continueWatchingTitleKey("tv", 1399)).toBe("tv:1399");
  });
});

describe("continue-watching dismissals", () => {
  it("hides a dismissed title from the continue watching list", () => {
    window.localStorage.removeItem(CONTINUE_WATCHING_DISMISSALS_STORAGE_KEY);

    const dismissedAt = 1_000;
    dismissContinueWatchingTitle("movie", 550, dismissedAt);

    expect(readContinueWatchingDismissals()).toEqual({
      "movie:550": { dismissedAt },
    });
    expect(
      isContinueWatchingTitleDismissed({
        mediaType: "movie",
        contentId: 550,
        updatedAt: dismissedAt,
      }),
    ).toBe(true);

    const visible = filterDismissedContinueWatching([
      {
        mediaType: "movie" as const,
        contentId: 550,
        updatedAt: 500,
        title: "Fight Club",
      },
    ]);

    expect(visible).toEqual([]);
  });

  it("brings the title back when updatedAt is newer than dismissedAt", () => {
    window.localStorage.removeItem(CONTINUE_WATCHING_DISMISSALS_STORAGE_KEY);

    dismissContinueWatchingTitle("tv", 1399, 1_000);

    expect(
      isContinueWatchingTitleDismissed({
        mediaType: "tv",
        contentId: 1399,
        updatedAt: 1_001,
      }),
    ).toBe(false);

    const visible = filterDismissedContinueWatching([
      {
        mediaType: "tv" as const,
        contentId: 1399,
        updatedAt: 2_000,
        title: "Game of Thrones",
      },
    ]);

    expect(visible).toHaveLength(1);
    expect(visible[0]?.contentId).toBe(1399);
  });

  it("leaves other titles visible", () => {
    window.localStorage.removeItem(CONTINUE_WATCHING_DISMISSALS_STORAGE_KEY);

    dismissContinueWatchingTitle("movie", 550, 1_000);

    const visible = filterDismissedContinueWatching([
      {
        mediaType: "movie" as const,
        contentId: 550,
        updatedAt: 500,
        title: "Fight Club",
      },
      {
        mediaType: "movie" as const,
        contentId: 551,
        updatedAt: 500,
        title: "Other Movie",
      },
      {
        mediaType: "tv" as const,
        contentId: 550,
        updatedAt: 500,
        title: "Same id, different type",
      },
    ]);

    expect(
      visible.map((item) => `${item.mediaType}:${item.contentId}`),
    ).toEqual(["movie:551", "tv:550"]);
  });

  it("treats invalid JSON in localStorage as an empty map", () => {
    window.localStorage.setItem(
      CONTINUE_WATCHING_DISMISSALS_STORAGE_KEY,
      "{not-json",
    );

    expect(readContinueWatchingDismissals()).toEqual({});
    expect(
      isContinueWatchingTitleDismissed({
        mediaType: "movie",
        contentId: 550,
        updatedAt: 1,
      }),
    ).toBe(false);
    expect(
      filterDismissedContinueWatching([
        {
          mediaType: "movie" as const,
          contentId: 550,
          updatedAt: 1,
        },
      ]),
    ).toHaveLength(1);
  });
});
