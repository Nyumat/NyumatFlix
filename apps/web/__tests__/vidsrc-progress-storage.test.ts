import { beforeEach, describe, expect, it } from "vitest";

import {
  readVidsrcProgressEntries,
  VIDSRC_PROGRESS_STORAGE_KEY,
  type VidsrcProgressEntry,
} from "@/lib/playback/vidsrc-progress-storage";

const movieEntry = (id: string, lastUpdated: number): VidsrcProgressEntry => ({
  id,
  type: "movie",
  last_updated: lastUpdated,
});

describe("readVidsrcProgressMap", () => {
  beforeEach(() => {
    window.localStorage.removeItem(VIDSRC_PROGRESS_STORAGE_KEY);
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
