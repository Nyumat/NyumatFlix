import { describe, expect, it } from "vitest";
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
