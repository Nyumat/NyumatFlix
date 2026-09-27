import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchSiteFlags,
  resetSiteFlagsClientForTests,
} from "@/lib/flags/site-flags-client";

describe("fetchSiteFlags", () => {
  afterEach(() => {
    resetSiteFlagsClientForTests();
    vi.unstubAllGlobals();
  });

  it("joins in-flight reads and reuses a fresh result until forced", async () => {
    const fetchMock = vi.fn(async () => {
      return {
        ok: true,
        json: async () => ({ policyGeneration: "a" }),
      } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    const first = fetchSiteFlags();
    const second = fetchSiteFlags();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/site/flags", {
      cache: "no-store",
    });

    await expect(first).resolves.toEqual({ policyGeneration: "a" });
    await expect(second).resolves.toEqual({ policyGeneration: "a" });

    await fetchSiteFlags();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await fetchSiteFlags({ force: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
