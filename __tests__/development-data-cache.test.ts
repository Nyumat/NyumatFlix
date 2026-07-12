import {
  AsyncExpiringLruCache,
  clearDevelopmentDataCache,
  withDevelopmentDataCache,
} from "@/lib/server/development-data-cache";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("development data cache", () => {
  afterEach(() => {
    clearDevelopmentDataCache();
    vi.unstubAllEnvs();
  });

  it("reuses a value until its TTL expires", async () => {
    const cache = new AsyncExpiringLruCache(10);
    const load = vi.fn(async () => load.mock.calls.length);
    let now = 100;

    await expect(
      cache.getOrLoad({ key: "catalog", load, ttlMs: 50, now: () => now }),
    ).resolves.toBe(1);
    await expect(
      cache.getOrLoad({ key: "catalog", load, ttlMs: 50, now: () => now }),
    ).resolves.toBe(1);

    now = 150;
    await expect(
      cache.getOrLoad({ key: "catalog", load, ttlMs: 50, now: () => now }),
    ).resolves.toBe(2);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("shares an in-flight request", async () => {
    const cache = new AsyncExpiringLruCache(10);
    let resolveLoad: ((value: string) => void) | undefined;
    const load = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveLoad = resolve;
        }),
    );

    const first = cache.getOrLoad({ key: "catalog", load });
    const second = cache.getOrLoad({ key: "catalog", load });
    resolveLoad?.("stable");

    await expect(Promise.all([first, second])).resolves.toEqual([
      "stable",
      "stable",
    ]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("does not retain rejected requests", async () => {
    const cache = new AsyncExpiringLruCache(10);
    const load = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("upstream failed"))
      .mockResolvedValueOnce("recovered");

    await expect(cache.getOrLoad({ key: "catalog", load })).rejects.toThrow(
      "upstream failed",
    );
    await expect(cache.getOrLoad({ key: "catalog", load })).resolves.toBe(
      "recovered",
    );
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("does not retain a successful fallback result", async () => {
    const cache = new AsyncExpiringLruCache(10);
    const load = vi
      .fn<() => Promise<{ cacheable: boolean; value: string }>>()
      .mockResolvedValueOnce({ cacheable: false, value: "fallback" })
      .mockResolvedValueOnce({ cacheable: true, value: "fresh" });

    await expect(
      cache.getOrLoad({
        key: "catalog",
        load,
        cacheResult: ({ cacheable }) => cacheable,
      }),
    ).resolves.toMatchObject({ value: "fallback" });
    await expect(
      cache.getOrLoad({
        key: "catalog",
        load,
        cacheResult: ({ cacheable }) => cacheable,
      }),
    ).resolves.toMatchObject({ value: "fresh" });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("evicts the least recently used entry", async () => {
    const cache = new AsyncExpiringLruCache(2);
    const load = vi.fn(async (value: string) => value);

    await cache.getOrLoad({ key: "a", load: () => load("a") });
    await cache.getOrLoad({ key: "b", load: () => load("b") });
    await cache.getOrLoad({ key: "a", load: () => load("unused") });
    await cache.getOrLoad({ key: "c", load: () => load("c") });
    await cache.getOrLoad({ key: "b", load: () => load("b-new") });

    expect(load.mock.calls.map(([value]) => value)).toEqual([
      "a",
      "b",
      "c",
      "b-new",
    ]);
  });

  it("keeps an enriched layout identical within the development TTL", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const load = vi
      .fn<() => Promise<{ rows: string[][] }>>()
      .mockResolvedValueOnce({ rows: [["Charlotte", "Toradora!"]] })
      .mockResolvedValueOnce({ rows: [["A different response"]] });

    const first = await withDevelopmentDataCache({
      key: "anime-hub:summer-2026",
      load,
    });
    const second = await withDevelopmentDataCache({
      key: "anime-hub:summer-2026",
      load,
    });

    expect(second).toEqual(first);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("bypasses the cache outside development", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const load = vi.fn(async () => load.mock.calls.length);

    await expect(
      withDevelopmentDataCache({ key: "catalog", load }),
    ).resolves.toBe(1);
    await expect(
      withDevelopmentDataCache({ key: "catalog", load }),
    ).resolves.toBe(2);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
