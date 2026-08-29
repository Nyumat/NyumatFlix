import { describe, expect, it } from "vitest";

import {
  buildLiveChannelShareUrl,
  buildLiveShareUrlFromSlug,
  formatChannelSlugForDisplay,
  getChannelShareSlug,
  resolveChannelFromSlug,
  slugifyChannelName,
} from "@/lib/live/channel-slugs";
import type { LiveChannel } from "@/lib/live/types";

const channel = (
  overrides: Partial<LiveChannel> & Pick<LiveChannel, "name">,
): LiveChannel => ({
  id: "dulo-channel-test",
  category: "entertainment",
  categoryName: "Entertainment",
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

describe("channel slugs", () => {
  it("slugifies channel names", () => {
    expect(slugifyChannelName("Cartoon Network")).toBe("cartoonnetwork");
    expect(slugifyChannelName("ESPN 2")).toBe("espn2");
  });

  it("resolves ANIME x HIDIVE share slugs", () => {
    const hidive = channel({ name: "ANIME x HIDIVE" });

    expect(getChannelShareSlug(hidive)).toBe("hidive");
    expect(buildLiveShareUrlFromSlug("hidive")).toBe(
      "https://nyumatflix.com/live?ch=hidive",
    );
    expect(resolveChannelFromSlug("hidive", [hidive])?.name).toBe(
      "ANIME x HIDIVE",
    );
  });

  it("uses short share slugs for known channels", () => {
    expect(getChannelShareSlug(channel({ name: "Cartoon Network" }))).toBe(
      "cn",
    );
    expect(getChannelShareSlug(channel({ name: "ESPN" }))).toBe("espn");
  });

  it("builds share urls with channel slug", () => {
    expect(buildLiveChannelShareUrl(channel({ name: "ESPN" }))).toBe(
      "https://nyumatflix.com/live?ch=espn",
    );
    expect(buildLiveChannelShareUrl(channel({ name: "Cartoon Network" }))).toBe(
      "https://nyumatflix.com/live?ch=cn",
    );
  });

  it("resolves aliases to channels", () => {
    const channels = [
      channel({ id: "dulo-channel-1", name: "Cartoon Network" }),
      channel({ id: "dulo-channel-2", name: "CNN" }),
      channel({ id: "dulo-channel-3", name: "ESPN" }),
    ];

    expect(resolveChannelFromSlug("cn", channels)?.name).toBe(
      "Cartoon Network",
    );
    expect(resolveChannelFromSlug("espn", channels)?.name).toBe("ESPN");
    expect(resolveChannelFromSlug("cnn", channels)?.name).toBe("CNN");
  });

  it("formats slugs for display metadata", () => {
    expect(formatChannelSlugForDisplay("cn")).toBe("Cartoon Network");
    expect(formatChannelSlugForDisplay("espn")).toBe("ESPN");
    expect(buildLiveShareUrlFromSlug("cartoon-network")).toBe(
      "https://nyumatflix.com/live?ch=cn",
    );
  });

  it("prefers exact slug matches over partial matches", () => {
    const channels = [
      channel({ id: "dulo-channel-1", name: "Fox News" }),
      channel({ id: "dulo-channel-2", name: "Fox Sports 1" }),
    ];

    expect(resolveChannelFromSlug("foxnews", channels)?.name).toBe("Fox News");
  });
});
