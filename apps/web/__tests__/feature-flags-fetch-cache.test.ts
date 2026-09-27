import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("feature flags client fetch", () => {
  it("shares one uncached flags read and skips tab-focus refetch", () => {
    const client = readFileSync(
      resolve("lib/flags/site-flags-client.ts"),
      "utf8",
    );
    const provider = readFileSync(
      resolve("components/providers/feature-flags-provider.tsx"),
      "utf8",
    );
    const layout = readFileSync(resolve("app/layout.tsx"), "utf8");

    expect(client).toContain('fetch("/api/site/flags"');
    expect(client).toContain('cache: "no-store"');
    expect(client).toContain("inFlight");
    expect(provider).toContain("fetchSiteFlags");
    expect(provider).toContain("FLAGS_UPDATED_BROADCAST_CHANNEL");
    expect(provider).not.toContain('addEventListener("focus"');
    expect(provider).not.toContain('addEventListener("visibilitychange"');
    expect(layout).toContain("initialFlags={siteFlags}");
  });

  it("does not publicly cache the flags response", () => {
    const route = readFileSync(resolve("app/api/site/flags/route.ts"), "utf8");
    const server = readFileSync(
      resolve("lib/flags/site-flags-server.ts"),
      "utf8",
    );
    const save = readFileSync(resolve("app/api/ffs/flags/route.ts"), "utf8");

    expect(route).toContain('"Cache-Control": "private, no-store"');
    expect(route).not.toContain("s-maxage=300");
    expect(server).toContain("revalidate: 5");
    expect(server).toContain("expire: 15");
    expect(server).toContain('cacheLife("hours")');
    expect(server).toContain("export async function getShellSiteFlags");

    const layout = readFileSync(resolve("app/layout.tsx"), "utf8");
    expect(layout).toContain("getShellSiteFlags()");
    expect(layout).not.toContain("getCachedSiteFlags");
    expect(save).toContain(
      "revalidateTag(SITE_FLAGS_CACHE_TAG, { expire: 0 })",
    );
  });
});
