import { describe, expect, it } from "vitest";
import { buildMalScrobblePayload } from "@/lib/mal/scrobble-payload";
import {
  mapMalStatusToWatchlistStatus,
  mapWatchlistStatusToMalStatus,
} from "@/lib/mal/status-maps";

describe("MyAnimeList status mappings", () => {
  it("losslessly maps MAL statuses to NyumatFlix watchlist statuses", () => {
    expect(mapMalStatusToWatchlistStatus("completed")).toBe("completed");
    expect(mapMalStatusToWatchlistStatus("plan_to_watch")).toBe(
      "plan_to_watch",
    );
    expect(mapMalStatusToWatchlistStatus("watching")).toBe("watching");
    expect(mapMalStatusToWatchlistStatus("on_hold")).toBe("on_hold");
    expect(mapMalStatusToWatchlistStatus("dropped")).toBe("dropped");
    expect(mapMalStatusToWatchlistStatus(undefined)).toBe("watching");
  });

  it("losslessly maps NyumatFlix watchlist statuses to MAL statuses", () => {
    expect(mapWatchlistStatusToMalStatus("completed")).toBe("completed");
    expect(mapWatchlistStatusToMalStatus("plan_to_watch")).toBe(
      "plan_to_watch",
    );
    expect(mapWatchlistStatusToMalStatus("watching")).toBe("watching");
    expect(mapWatchlistStatusToMalStatus("on_hold")).toBe("on_hold");
    expect(mapWatchlistStatusToMalStatus("dropped")).toBe("dropped");
  });
});

describe("MAL scrobble payload", () => {
  it("does not mark the current episode watched until it is completed", () => {
    expect(
      buildMalScrobblePayload({
        episodeNumber: 1,
        episodeCompleted: false,
        currentListStatus: null,
      }),
    ).toEqual({ status: "watching" });
  });

  it("moves plan-to-watch to watching without incrementing episode count", () => {
    expect(
      buildMalScrobblePayload({
        episodeNumber: 1,
        currentListStatus: { status: "plan_to_watch", num_episodes_watched: 0 },
      }),
    ).toEqual({ status: "watching" });
  });

  it("increments watched episodes only after the episode is completed", () => {
    expect(
      buildMalScrobblePayload({
        episodeNumber: 1,
        episodeCompleted: true,
        currentListStatus: { status: "watching", num_episodes_watched: 0 },
      }),
    ).toEqual({ num_episodes_watched: 1 });
  });

  it("does not decrease an existing MAL episode count", () => {
    expect(
      buildMalScrobblePayload({
        episodeNumber: 1,
        episodeCompleted: true,
        currentListStatus: { status: "watching", num_episodes_watched: 4 },
      }),
    ).toEqual({});
  });
});
