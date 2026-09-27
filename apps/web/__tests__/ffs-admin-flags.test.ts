import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET, PATCH } from "@/app/api/ffs/flags/route";
import {
  applyPlaybackMutualExclusion,
  buildDefaultAdminFlagState,
} from "@/lib/flags/flag-catalog";
import { assertFfsHost, isFfsHost } from "@/lib/ffs/require-ffs-host";
import {
  isFfsAdminPath,
  shouldSkipRouteScrollManagement,
} from "@/lib/ffs/ffs-host-paths";
import { DEFAULT_ANNOUNCEMENT_BANNER_CONFIG } from "@/lib/flags/announcement-banner";
import { DEFAULT_PROVIDER_MENU_ORDER } from "@/lib/flags/provider-menu-order";
import { DEFAULT_HERO_BACKDROP_OVERRIDES } from "@/lib/flags/hero-backdrop-overrides";
import { DEFAULT_EXPERIENCE_DEFAULTS } from "@/lib/flags/experience-defaults";

vi.mock("@/lib/flags/flipt-admin", () => ({
  readAdminFlagState: vi.fn(async () => buildDefaultAdminFlagState()),
  readAnnouncementBannerConfig: vi.fn(
    async () => DEFAULT_ANNOUNCEMENT_BANNER_CONFIG,
  ),
  readProviderMenuOrderConfig: vi.fn(async () => DEFAULT_PROVIDER_MENU_ORDER),
  readHeroBackdropOverridesConfig: vi.fn(
    async () => DEFAULT_HERO_BACKDROP_OVERRIDES,
  ),
  readExperienceDefaultsConfig: vi.fn(async () => DEFAULT_EXPERIENCE_DEFAULTS),
  writeAdminFlagState: vi.fn(async () => undefined),
}));

const { readAdminFlagState, writeAdminFlagState } = await import(
  "@/lib/flags/flipt-admin"
);

describe("ffs admin flags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("detects ffs admin paths", () => {
    expect(isFfsAdminPath("/ffs")).toBe(true);
    expect(isFfsAdminPath("/ffs/")).toBe(true);
    expect(isFfsAdminPath("/movies")).toBe(false);
  });

  it("skips route scroll management on ffs admin surfaces", () => {
    expect(shouldSkipRouteScrollManagement("/ffs")).toBe(true);
    expect(shouldSkipRouteScrollManagement("/", "ffs.localhost:3000")).toBe(
      true,
    );
    expect(shouldSkipRouteScrollManagement("/movies", "localhost:3000")).toBe(
      false,
    );
  });

  it("detects ffs hostnames", () => {
    expect(isFfsHost("ffs.nyumatflix.com")).toBe(true);
    expect(isFfsHost("ffs.localhost:3000")).toBe(true);
    expect(isFfsHost("nyumatflix.com")).toBe(false);
    expect(
      assertFfsHost(
        new NextRequest("http://ffs.localhost/ffs", {
          headers: { host: "ffs.localhost:3000" },
        }),
      ),
    ).toBe(true);
    expect(
      assertFfsHost(
        new NextRequest("http://localhost/ffs", {
          headers: { host: "localhost:3000" },
        }),
      ),
    ).toBe(false);
  });

  it("clears iframe-only when proxy-only is enabled", () => {
    const next = applyPlaybackMutualExclusion({
      ...buildDefaultAdminFlagState(),
      "global.proxy_mode_only": true,
      "global.iframe_mode_only": true,
    });

    expect(next["global.proxy_mode_only"]).toBe(true);
    expect(next["global.iframe_mode_only"]).toBe(false);
  });

  it("clears soft defaults when a hard playback lock is enabled", () => {
    const next = applyPlaybackMutualExclusion({
      ...buildDefaultAdminFlagState(),
      "global.proxy_mode_only": true,
      "global.default_proxy_playback": true,
      "global.no_ads_mode_default": true,
    });

    expect(next["global.default_proxy_playback"]).toBe(false);
    expect(next["global.no_ads_mode_default"]).toBe(false);
  });

  it("keeps only one soft default when both are set without a changed key", () => {
    const next = applyPlaybackMutualExclusion({
      ...buildDefaultAdminFlagState(),
      "global.default_proxy_playback": true,
      "global.no_ads_mode_default": true,
    });

    expect(next["global.no_ads_mode_default"]).toBe(true);
    expect(next["global.default_proxy_playback"]).toBe(false);
  });

  it("prefers default proxy when that flag was toggled on", () => {
    const next = applyPlaybackMutualExclusion(
      {
        ...buildDefaultAdminFlagState(),
        "global.default_proxy_playback": true,
        "global.no_ads_mode_default": true,
      },
      "global.default_proxy_playback",
    );

    expect(next["global.default_proxy_playback"]).toBe(true);
    expect(next["global.no_ads_mode_default"]).toBe(false);
  });

  it("returns 404 for admin API on the main site host", async () => {
    const response = await GET(
      new NextRequest("http://localhost:3000/api/ffs/flags", {
        headers: { host: "localhost:3000" },
      }),
    );
    expect(response.status).toBe(404);
  });

  it("reads flags on the ffs host", async () => {
    const response = await GET(
      new NextRequest("http://ffs.localhost:3000/api/ffs/flags", {
        headers: { host: "ffs.localhost:3000" },
      }),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      flags: Record<string, boolean>;
      heroBackdropOverrides: { entries: unknown[] };
    };
    expect(body.flags["global.auth_enabled"]).toBe(true);
    expect(body.heroBackdropOverrides.entries).toEqual([]);
    expect(readAdminFlagState).toHaveBeenCalledOnce();
  });

  it("writes flags on the ffs host", async () => {
    const flags = {
      ...buildDefaultAdminFlagState(),
      "global.live_tv_enabled": true,
    };

    const response = await PATCH(
      new NextRequest("http://ffs.localhost:3000/api/ffs/flags", {
        method: "PATCH",
        body: JSON.stringify({
          flags,
          announcementBanner: DEFAULT_ANNOUNCEMENT_BANNER_CONFIG,
        }),
        headers: {
          host: "ffs.localhost:3000",
          "Content-Type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(writeAdminFlagState).toHaveBeenCalledOnce();
  });

  it("persists hero backdrop overrides", async () => {
    const overrides = {
      version: 1 as const,
      entries: [
        {
          key: "movie:969681",
          mediaType: "movie" as const,
          title: "Spider-Man: Brand New Day",
          tmdbId: 969681,
          anilistId: null,
          malId: null,
          path: "/spidey.jpg",
          source: "tmdb" as const,
          label: "TMDB",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    };

    const response = await PATCH(
      new NextRequest("http://ffs.localhost:3000/api/ffs/flags", {
        method: "PATCH",
        body: JSON.stringify({
          flags: buildDefaultAdminFlagState(),
          heroBackdropOverrides: overrides,
        }),
        headers: {
          host: "ffs.localhost:3000",
          "Content-Type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      heroBackdropOverrides: { entries: Array<{ path: string }> };
    };
    expect(body.heroBackdropOverrides.entries[0]?.path).toBe("/spidey.jpg");
    expect(writeAdminFlagState).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ entries: overrides.entries }),
      expect.anything(),
    );
  });

  it("round-trips experience defaults on patch", async () => {
    const experienceDefaults = {
      ...DEFAULT_EXPERIENCE_DEFAULTS,
      playerEngine: "movi" as const,
      playbackAudio: "dub" as const,
    };

    const response = await PATCH(
      new NextRequest("http://ffs.localhost:3000/api/ffs/flags", {
        method: "PATCH",
        body: JSON.stringify({
          flags: buildDefaultAdminFlagState(),
          experienceDefaults,
        }),
        headers: {
          host: "ffs.localhost:3000",
          "Content-Type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      experienceDefaults: { playerEngine: string; playbackAudio: string };
    };
    expect(body.experienceDefaults.playerEngine).toBe("movi");
    expect(body.experienceDefaults.playbackAudio).toBe("dub");
    expect(writeAdminFlagState).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ playerEngine: "movi", playbackAudio: "dub" }),
    );
  });

  it("rejects an enabled banner without content", async () => {
    const response = await PATCH(
      new NextRequest("http://ffs.localhost:3000/api/ffs/flags", {
        method: "PATCH",
        body: JSON.stringify({
          flags: {
            ...buildDefaultAdminFlagState(),
            "global.announcement_banner": true,
          },
          announcementBanner: DEFAULT_ANNOUNCEMENT_BANNER_CONFIG,
        }),
        headers: {
          host: "ffs.localhost:3000",
          "Content-Type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(400);
    expect(writeAdminFlagState).not.toHaveBeenCalled();
  });
});
