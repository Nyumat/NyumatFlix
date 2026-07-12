import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET, PATCH } from "@/app/api/ffs/flags/route";
import {
  applyPlaybackMutualExclusion,
  buildDefaultAdminFlagState,
} from "@/lib/flags/flag-catalog";
import { assertFfsHost, isFfsHost } from "@/lib/ffs/require-ffs-host";

vi.mock("@/lib/flags/flipt-admin", () => ({
  readAdminFlagState: vi.fn(async () => buildDefaultAdminFlagState()),
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
        body: JSON.stringify({ flags }),
        headers: {
          host: "ffs.localhost:3000",
          "Content-Type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(writeAdminFlagState).toHaveBeenCalledOnce();
  });
});
