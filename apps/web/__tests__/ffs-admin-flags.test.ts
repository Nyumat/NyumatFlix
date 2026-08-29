import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET, PATCH } from "@/app/api/ffs/flags/route";
import {
  applyPlaybackMutualExclusion,
  buildDefaultAdminFlagState,
} from "@/lib/flags/flag-catalog";
import { assertFfsHost, isFfsHost } from "@/lib/ffs/require-ffs-host";
import { DEFAULT_ANNOUNCEMENT_BANNER_CONFIG } from "@/lib/flags/announcement-banner";
import { DEFAULT_PROVIDER_MENU_ORDER } from "@/lib/flags/provider-menu-order";

vi.mock("@/lib/flags/flipt-admin", () => ({
  readAdminFlagState: vi.fn(async () => buildDefaultAdminFlagState()),
  readAnnouncementBannerConfig: vi.fn(
    async () => DEFAULT_ANNOUNCEMENT_BANNER_CONFIG,
  ),
  readProviderMenuOrderConfig: vi.fn(async () => DEFAULT_PROVIDER_MENU_ORDER),
  writeAdminFlagState: vi.fn(async () => undefined),
}));

const { readAdminFlagState, writeAdminFlagState } = await import(
  "@/lib/flags/flipt-admin"
);

describe("ffs admin flags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    const body = (await response.json()) as { flags: Record<string, boolean> };
    expect(body.flags["global.auth_enabled"]).toBe(true);
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
