import { describe, expect, it } from "vitest";

import {
  pickDefaultLiveChannel,
  sortFeaturedLiveChannelsFirst,
} from "@/lib/live/defaults";
import type { LiveChannel } from "@/lib/live/types";

const channel = (
  overrides: Partial<LiveChannel> & Pick<LiveChannel, "name">,
): LiveChannel => ({
  id: "test-channel",
  category: "kids",
  categoryName: "Kids",
  country: "US",
  logoUrl: null,
  playUrl: "/api/live/play/test/index.m3u8",
  sourceUrl: "https://example.com/stream.m3u8",
  sourceHost: "example.com",
  availability: "ready",
  unavailableReason: null,
  kind: "channel",
  startsAt: null,
  label: null,
  searchText: overrides.name.toLowerCase(),
  ...overrides,
});

describe("live defaults", () => {
  it("prefers ANIME x HIDIVE as the default channel", () => {
    const selected = pickDefaultLiveChannel([
      channel({ name: "00s Replay" }),
      channel({ name: "CNN" }),
      channel({ name: "ANIME x HIDIVE", id: "hidive-pluto" }),
    ]);

    expect(selected?.name).toBe("ANIME x HIDIVE");
  });

  it("pins featured channels to the top of the guide", () => {
    const sorted = sortFeaturedLiveChannelsFirst([
      channel({ name: "00s Replay" }),
      channel({ name: "CNN" }),
      channel({ name: "Anime X HiDive", id: "hidive-roku" }),
    ]);

    expect(sorted[0]?.name).toBe("Anime X HiDive");
    expect(sorted.slice(1).map((item) => item.name)).toEqual([
      "00s Replay",
      "CNN",
    ]);
  });
});
