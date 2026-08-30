import { beforeEach, describe, expect, it } from "vitest";

import {
  persistVidsrcProgressPayload,
  readVidsrcProgressEntries,
  readVidsrcProgressMap,
  VIDSRC_PROGRESS_STORAGE_KEY,
  type VidsrcProgressEntry,
} from "@/lib/playback/vidsrc-progress-storage";

const movieEntry = (id: string, lastUpdated: number): VidsrcProgressEntry => ({
  id,
  type: "movie",
  last_updated: lastUpdated,
});

describe("persistVidsrcProgressPayload", () => {
  beforeEach(() => {
    window.localStorage.removeItem(VIDSRC_PROGRESS_STORAGE_KEY);
  });

  it("merges a single entry into an existing map", () => {
    persistVidsrcProgressPayload({
      "550": movieEntry("550", 100),
      "1399": movieEntry("1399", 200),
    });

    persistVidsrcProgressPayload(movieEntry("551", 300));

    expect(readVidsrcProgressEntries()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "550" }),
        expect.objectContaining({ id: "1399" }),
        expect.objectContaining({ id: "551" }),
      ]),
    );
    expect(readVidsrcProgressEntries()).toHaveLength(3);
  });

  it("keeps the newer entry when a single update is older", () => {
    persistVidsrcProgressPayload(movieEntry("550", 500));
    persistVidsrcProgressPayload(movieEntry("550", 100));

    const entries = readVidsrcProgressEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.last_updated).toBe(500);
  });

  it("replaces storage when the embed sends a full map", () => {
    persistVidsrcProgressPayload({
      "550": movieEntry("550", 100),
      "1399": movieEntry("1399", 200),
    });

    persistVidsrcProgressPayload({
      "551": movieEntry("551", 300),
    });

    const map = readVidsrcProgressMap();
    expect(Object.keys(map)).toEqual(["551"]);
  });

  it("normalizes a legacy single-entry payload when reading", () => {
    window.localStorage.setItem(
      VIDSRC_PROGRESS_STORAGE_KEY,
      JSON.stringify(movieEntry("550", 100)),
    );

    expect(readVidsrcProgressEntries()).toEqual([
      expect.objectContaining({ id: "550" }),
    ]);
  });
});
