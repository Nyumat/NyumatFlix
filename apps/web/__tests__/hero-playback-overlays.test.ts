import type { PlayableManifest } from "@nyumatflix/playback";
import { describe, expect, it } from "vitest";

import { resolveHeroPlaybackOverlays } from "@/lib/playback/hero-playback-overlays";
import { snapshotLivePlayback } from "@/lib/playback/retain-live-playback";
import {
  resolveNextProviderId,
  buildPinnedProviderResolveOrder,
} from "@/lib/scrape/next-provider";

describe("snapshotLivePlayback", () => {
  const result = { providerId: "vidsrc" };
  const manifest = { id: "m1" } as PlayableManifest;

  it("keeps a playing session", () => {
    expect(
      snapshotLivePlayback({
        status: "playing",
        result,
        manifest,
      }),
    ).toEqual({ result, manifest });
  });

  it("keeps a live session while a switch scrape is in flight", () => {
    expect(
      snapshotLivePlayback({
        status: "scraping",
        result,
        manifest,
      }),
    ).toEqual({ result, manifest });
  });

  it("does not keep an idle or empty session", () => {
    expect(
      snapshotLivePlayback({
        status: "playing",
        result: null,
        manifest: null,
      }),
    ).toBeNull();
    expect(
      snapshotLivePlayback({
        status: "error",
        result,
        manifest,
      }),
    ).toBeNull();
  });
});

describe("resolveHeroPlaybackOverlays", () => {
  it("shows the scrape list only when no player is up", () => {
    const firstLoad = resolveHeroPlaybackOverlays({
      isDirectMode: false,
      scrapeStatus: "scraping",
      hasManifest: false,
      mediaReady: false,
    });
    expect(firstLoad.showDiscoveryOverlay).toBe(true);
    expect(firstLoad.keepPlayer).toBe(false);
    expect(firstLoad.showBufferingOverlay).toBe(false);

    const switching = resolveHeroPlaybackOverlays({
      isDirectMode: false,
      scrapeStatus: "scraping",
      hasManifest: true,
      mediaReady: true,
    });
    expect(switching.showDiscoveryOverlay).toBe(false);
    expect(switching.keepPlayer).toBe(true);
    expect(switching.showBufferingOverlay).toBe(false);
    expect(switching.hideBackdrop).toBe(true);
    expect(switching.blurBackdrop).toBe(false);
  });

  it("covers the player until the first frame is ready", () => {
    const buffering = resolveHeroPlaybackOverlays({
      isDirectMode: false,
      scrapeStatus: "playing",
      hasManifest: true,
      mediaReady: false,
    });
    expect(buffering.showBufferingOverlay).toBe(true);
    expect(buffering.showDiscoveryOverlay).toBe(false);
    expect(buffering.hideBackdrop).toBe(false);
  });

  it("drops the starting overlay once media is ready", () => {
    const ready = resolveHeroPlaybackOverlays({
      isDirectMode: false,
      scrapeStatus: "playing",
      hasManifest: true,
      mediaReady: true,
    });
    expect(ready.showBufferingOverlay).toBe(false);
    expect(ready.hideBackdrop).toBe(true);
    expect(ready.blurBackdrop).toBe(false);
  });
});

describe("buildPinnedProviderResolveOrder", () => {
  it("returns the full order when nothing is pinned", () => {
    expect(buildPinnedProviderResolveOrder(["a", "b", "c"])).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("pins the chosen provider and keeps the rest for fallback racing", () => {
    expect(buildPinnedProviderResolveOrder(["a", "b", "c"], "c")).toEqual([
      "c",
      "a",
      "b",
    ]);
  });
});

describe("resolveNextProviderId", () => {
  it("returns the next provider in order", () => {
    expect(resolveNextProviderId(["a", "b", "c"], "a")).toBe("b");
    expect(resolveNextProviderId(["a", "b", "c"], "b")).toBe("c");
  });

  it("returns null when there is no next provider", () => {
    expect(resolveNextProviderId(["a", "b"], "b")).toBeNull();
    expect(resolveNextProviderId(["a"], "a")).toBeNull();
    expect(resolveNextProviderId(["a", "b"], "missing")).toBeNull();
  });
});
