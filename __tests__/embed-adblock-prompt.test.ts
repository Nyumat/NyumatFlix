import { describe, expect, it } from "vitest";

import { getDefaultSiteFlags } from "@/lib/flags/site-flags";
import { shouldBypassEmbedAdblockPrompt } from "@/lib/playback/embed-adblock-prompt";
import { scrapeServer } from "@/lib/stores/server-store";
import { videoServers } from "@/lib/stores/video-servers";

const embedServer = videoServers[0]!;

describe("shouldBypassEmbedAdblockPrompt", () => {
  it("bypasses for scrape, no-ads, and proxy defaults", () => {
    const flags = getDefaultSiteFlags();

    expect(
      shouldBypassEmbedAdblockPrompt({
        noAdsMode: true,
        flags,
        selectedServer: embedServer,
      }),
    ).toBe(true);

    expect(
      shouldBypassEmbedAdblockPrompt({
        noAdsMode: false,
        flags: { ...flags, proxyModeOnly: true },
        selectedServer: embedServer,
      }),
    ).toBe(true);

    expect(
      shouldBypassEmbedAdblockPrompt({
        noAdsMode: false,
        flags: { ...flags, defaultProxyPlayback: true },
        selectedServer: embedServer,
      }),
    ).toBe(true);

    expect(
      shouldBypassEmbedAdblockPrompt({
        noAdsMode: false,
        flags,
        selectedServer: scrapeServer,
      }),
    ).toBe(true);
  });

  it("prompts only for embed playback in choice mode", () => {
    const flags = getDefaultSiteFlags();

    expect(
      shouldBypassEmbedAdblockPrompt({
        noAdsMode: false,
        flags,
        selectedServer: embedServer,
      }),
    ).toBe(false);
  });
});
