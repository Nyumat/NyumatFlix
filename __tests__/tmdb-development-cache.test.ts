import {
  clearDevelopmentDataCache,
  DEVELOPMENT_DATA_CACHE_TTL_MS,
} from "@/lib/server/development-data-cache";
import { api } from "@/tmdb/api";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("TMDB development caching", () => {
  afterEach(() => {
    clearDevelopmentDataCache();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("shares ordinary catalog responses", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            page: 1,
            results: [{ id: fetchMock.mock.calls.length }],
          }),
        ),
    );

    const first = await api.fetcher({
      endpoint: "movie/popular",
      params: { page: "1", region: "US" },
    });
    const second = await api.fetcher({
      endpoint: "movie/popular",
      params: { region: "US", page: "1" },
    });

    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(DEVELOPMENT_DATA_CACHE_TTL_MS).toBe(3_600_000);
  });

  it("does not cache large no-store responses", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(
        async () =>
          new Response(
            JSON.stringify({ request: fetchMock.mock.calls.length }),
          ),
      );

    const first = await api.fetcher({
      endpoint: "tv/95479",
      params: { append_to_response: "images,credits" },
    });
    const second = await api.fetcher({
      endpoint: "tv/95479",
      params: { append_to_response: "images,credits" },
    });

    expect(second).not.toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not cache an empty network fallback", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ page: 1, results: [{ id: 42 }] })),
      );

    const first = await api.fetcher({ endpoint: "movie/popular" });
    const second = await api.fetcher({ endpoint: "movie/popular" });

    expect(first).toMatchObject({ results: [] });
    expect(second).toMatchObject({ results: [{ id: 42 }] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
