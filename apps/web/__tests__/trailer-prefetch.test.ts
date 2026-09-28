import { afterEach, describe, expect, it, vi } from "vitest";

import { prefetchTrailerStream } from "@/hooks/use-videasy-trailer-stream";

const jsonResponse = (body: unknown): Response =>
  ({
    ok: true,
    json: async () => body,
  }) as Response;

describe("prefetchTrailerStream", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches a stream source and reuses the cache", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ url: "https://cdn.example/x.mp4" }));

    prefetchTrailerStream({ kind: "stream", imdbId: "tt9900001" });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    prefetchTrailerStream({ kind: "stream", imdbId: "tt9900001" });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("resolves a TMDB-id source with tmdbId + mediaType params", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ url: "https://cdn.example/y.mp4" }));

    prefetchTrailerStream({
      kind: "stream",
      tmdbId: 424242,
      mediaType: "movie",
    });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain("tmdbId=424242");
    expect(String(url)).toContain("mediaType=movie");
  });

  it("ignores YouTube and empty sources", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    prefetchTrailerStream({ kind: "youtube", youtubeKey: "abc123" });
    prefetchTrailerStream(undefined);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
