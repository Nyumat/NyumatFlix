import { describe, expect, it } from "vitest";

import { shouldApplyMalPatchResponse } from "@/lib/mal/list-index-shared";
import {
  notifyPlaybackProgressChanged,
  PLAYBACK_PROGRESS_CHANGED_EVENT,
  subscribePlaybackProgressChanged,
} from "@/lib/playback/progress-change-events";

describe("shouldApplyMalPatchResponse", () => {
  it("accepts only the latest patch generation", () => {
    expect(shouldApplyMalPatchResponse(2, 2)).toBe(true);
    expect(shouldApplyMalPatchResponse(1, 2)).toBe(false);
  });
});

describe("playback progress change events", () => {
  it("dispatches a custom event when progress changes", () => {
    let count = 0;
    const unsubscribe = subscribePlaybackProgressChanged(() => {
      count += 1;
    });

    notifyPlaybackProgressChanged();
    unsubscribe();

    expect(count).toBe(1);
  });

  it("exposes a stable event name", () => {
    expect(PLAYBACK_PROGRESS_CHANGED_EVENT).toBe(
      "nyumatflix:playback-progress-changed",
    );
  });
});
