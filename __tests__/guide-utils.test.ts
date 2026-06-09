import { describe, expect, it } from "vitest";

import {
  buildLiveChannelsResponse,
  dedupeLiveChannels,
  filterPlayableLiveChannels,
  mergeLiveChannelGuides,
  toPlayableLiveGuide,
} from "@/lib/live/guide-utils";
import type { LiveChannel } from "@/lib/live/types";

const channel = (
  overrides: Partial<LiveChannel> & Pick<LiveChannel, "id" | "name">,
): LiveChannel => ({
  category: "entertainment",
  categoryName: "Entertainment",
  country: "US",
  logoUrl: null,
  playUrl: "/api/live/play/test/index.m3u8",
  sourceUrl: `https://example.com/${overrides.id}.m3u8`,
  sourceHost: "example.com",
  availability: "ready",
  unavailableReason: null,
  kind: "channel",
  startsAt: null,
  label: null,
  searchText: overrides.name.toLowerCase(),
  ...overrides,
});

describe("guide utils", () => {
  it("dedupes channels by source url", () => {
    const channels = dedupeLiveChannels([
      channel({ id: "a", name: "Alpha" }),
      channel({
        id: "b",
        name: "Alpha Duplicate",
        sourceUrl: "https://example.com/a.m3u8",
      }),
    ]);

    expect(channels).toHaveLength(1);
  });

  it("dedupes channels with the same id but different source urls", () => {
    const channels = dedupeLiveChannels([
      channel({
        id: "open-pluto-cnn",
        name: "CNN",
        sourceUrl: "https://example.com/cnn-a.m3u8",
      }),
      channel({
        id: "open-pluto-cnn",
        name: "CNN Mirror",
        sourceUrl: "https://example.com/cnn-b.m3u8",
      }),
    ]);

    expect(channels).toHaveLength(1);
    expect(channels[0]?.name).toBe("CNN");
  });

  it("merges guides and marks full phase", () => {
    const current = buildLiveChannelsResponse(
      [channel({ id: "a", name: "Alpha" })],
      { guidePhase: "bootstrap", guideComplete: false },
    );
    const incoming = buildLiveChannelsResponse(
      [channel({ id: "b", name: "Beta" })],
      { guidePhase: "full", guideComplete: true },
    );

    const merged = mergeLiveChannelGuides(current, incoming);

    expect(merged.channels).toHaveLength(2);
    expect(merged.guideComplete).toBe(true);
    expect(merged.guidePhase).toBe("full");
  });

  it("filters unsupported channels from playable guides", () => {
    const guide = buildLiveChannelsResponse([
      channel({ id: "a", name: "Alpha" }),
      channel({
        id: "b",
        name: "Broken",
        playUrl: null,
        availability: "unsupported",
        unavailableReason: "Device-specific stream URL",
      }),
    ]);

    const playable = toPlayableLiveGuide(guide);

    expect(filterPlayableLiveChannels(guide.channels)).toHaveLength(1);
    expect(playable.channels).toHaveLength(1);
    expect(playable.channels[0]?.name).toBe("Alpha");
    expect(playable.totals.ready).toBe(1);
  });
});
