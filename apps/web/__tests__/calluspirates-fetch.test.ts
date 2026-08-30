// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchCalluspirates } from "@/lib/scrape/calluspirates-fetch";

describe("fetchCalluspirates", () => {
  const originalSecret = process.env.CALLUSPIRATES_INTERNAL_SECRET;

  beforeEach(() => {
    process.env.CALLUSPIRATES_INTERNAL_SECRET = "test-secret";
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.CALLUSPIRATES_INTERNAL_SECRET;
    } else {
      process.env.CALLUSPIRATES_INTERNAL_SECRET = originalSecret;
    }
    vi.restoreAllMocks();
  });

  it("forwards an already-aborted caller signal to fetch", async () => {
    const controller = new AbortController();
    controller.abort();

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));

    await fetchCalluspirates("https://example.test/api/streams", {
      signal: controller.signal,
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.signal?.aborted).toBe(true);
    expect(init?.cache).toBe("no-store");
  });
});
