import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useProviderScrapeLoop } from "@/hooks/use-provider-scrape-loop";
import { fetchDirectMovieStreams } from "@/lib/direct/client-streams";

vi.mock("@/lib/cap/client", () => ({
  fetchWithCapSession: (url: string, init?: RequestInit) =>
    globalThis.fetch(url, init),
}));

describe("provider scrape loop retries", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("retries failed proxy option fetches up to 2 times and succeeds on retry", async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      callCount += 1;
      if (callCount < 3) {
        return new Response(
          JSON.stringify({ ok: false, error: "Transient network issue" }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
      return new Response(
        JSON.stringify({
          ok: true,
          providerId: "vidsrc",
          streamUrl: "https://example.com/master.m3u8",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    });

    const { result } = renderHook(() =>
      useProviderScrapeLoop({
        providerOrder: ["vidsrc"] as const,
        providerLabels: { vidsrc: "VidSrc" },
        mediaKeyFor: (input: { tmdbId: number }) => String(input.tmdbId),
        allFailedError: "All failed",
        apiPath: "/api/scrape",
        buildRequestBody: (providerId, input) => ({ providerId, ...input }),
        retryAttempts: 2,
        retryDelayMs: 10,
      }),
    );

    act(() => {
      result.current.startScraping({ tmdbId: 123 });
    });

    await waitFor(() => {
      expect(result.current.status).toBe("playing");
    });

    expect(callCount).toBe(3);
    expect(result.current.result?.providerId).toBe("vidsrc");
  });

  it("marks failure after exhausting 2 retries (3 total attempts)", async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      callCount += 1;
      return new Response(
        JSON.stringify({ ok: false, error: "Persistent server error" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    });

    const { result } = renderHook(() =>
      useProviderScrapeLoop({
        providerOrder: ["vidsrc"] as const,
        providerLabels: { vidsrc: "VidSrc" },
        mediaKeyFor: (input: { tmdbId: number }) => String(input.tmdbId),
        allFailedError: "All failed",
        apiPath: "/api/scrape",
        buildRequestBody: (providerId, input) => ({ providerId, ...input }),
        retryAttempts: 2,
        retryDelayMs: 10,
      }),
    );

    act(() => {
      result.current.startScraping({ tmdbId: 456 });
    });

    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });

    expect(callCount).toBe(3);
    expect(result.current.items[0]?.status).toBe("failure");
  });

  it("does not retry permanent 403 policy rejections", async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      callCount += 1;
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Provider disabled by site policy",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        },
      );
    });

    const { result } = renderHook(() =>
      useProviderScrapeLoop({
        providerOrder: ["vidsrc"] as const,
        providerLabels: { vidsrc: "VidSrc" },
        mediaKeyFor: (input: { tmdbId: number }) => String(input.tmdbId),
        allFailedError: "All failed",
        apiPath: "/api/scrape",
        buildRequestBody: (providerId, input) => ({ providerId, ...input }),
        retryAttempts: 2,
        retryDelayMs: 10,
      }),
    );

    act(() => {
      result.current.startScraping({ tmdbId: 789 });
    });

    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });

    expect(callCount).toBe(1);
  });

  it("retries on thrown network errors and succeeds", async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      callCount += 1;
      if (callCount < 2) {
        throw new TypeError("Failed to fetch");
      }
      return new Response(
        JSON.stringify({
          ok: true,
          providerId: "vidsrc",
          streamUrl: "https://example.com/master.m3u8",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    });

    const { result } = renderHook(() =>
      useProviderScrapeLoop({
        providerOrder: ["vidsrc"] as const,
        providerLabels: { vidsrc: "VidSrc" },
        mediaKeyFor: (input: { tmdbId: number }) => String(input.tmdbId),
        allFailedError: "All failed",
        apiPath: "/api/scrape",
        buildRequestBody: (providerId, input) => ({ providerId, ...input }),
        retryAttempts: 2,
        retryDelayMs: 10,
      }),
    );

    act(() => {
      result.current.startScraping({ tmdbId: 999 });
    });

    await waitFor(() => {
      expect(result.current.status).toBe("playing");
    });

    expect(callCount).toBe(2);
    expect(result.current.result?.providerId).toBe("vidsrc");
  });
});

describe("direct streams json client retries", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("retries direct stream discovery on 500 error and succeeds", async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      callCount += 1;
      if (callCount < 3) {
        return new Response("Internal Server Error", { status: 500 });
      }
      return new Response(
        JSON.stringify({
          streams: [
            {
              name: "Movie.1080p",
              url: "/api/direct/stream1",
              resolution: "1080p",
            },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    });

    const res = await fetchDirectMovieStreams(100);
    expect(callCount).toBe(3);
    expect(res.streams?.length).toBe(1);
  });
});
