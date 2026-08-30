import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useProviderScrapeLoop } from "@/hooks/use-provider-scrape-loop";

vi.mock("@/lib/cap/client", () => ({
  fetchWithCapSession: (url: string, init?: RequestInit) =>
    globalThis.fetch(url, init),
}));

type TestProviderId = "vidsrc" | "vixsrc" | "flixhq";

const successResponse = (providerId: TestProviderId) =>
  new Response(
    JSON.stringify({
      ok: true,
      providerId,
      streamUrl: `https://example.com/${providerId}.m3u8`,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );

const failureResponse = () =>
  new Response(JSON.stringify({ ok: false, error: "Provider failed" }), {
    status: 500,
    headers: { "Content-Type": "application/json" },
  });

const createHook = (
  providerOrder: readonly TestProviderId[] = ["vidsrc", "vixsrc", "flixhq"],
  onAllProvidersFailed?: () => void,
) =>
  renderHook(() =>
    useProviderScrapeLoop({
      providerOrder,
      providerLabels: {
        vidsrc: "VidSrc",
        vixsrc: "VixSrc",
        flixhq: "FlixHQ",
      },
      mediaKeyFor: (input: { tmdbId: number }) => String(input.tmdbId),
      allFailedError: "All failed",
      apiPath: "/api/scrape",
      buildRequestBody: (providerId, input) => ({ providerId, ...input }),
      retryAttempts: 0,
      retryDelayMs: 10,
      onAllProvidersFailed,
    }),
  );

const parseProviderId = (init?: RequestInit): TestProviderId => {
  const body = JSON.parse(String(init?.body)) as { providerId: TestProviderId };
  return body.providerId;
};

describe("provider scrape loop pinned selection", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("switchToProvider only races the pinned provider for playback", async () => {
    const playbackFetches: TestProviderId[] = [];

    globalThis.fetch = vi.fn().mockImplementation(async (_url, init) => {
      const providerId = parseProviderId(init);
      playbackFetches.push(providerId);

      if (providerId === "vidsrc") {
        return failureResponse();
      }

      return successResponse(providerId);
    });

    const { result } = createHook();

    act(() => {
      result.current.switchToProvider({ tmdbId: 1 }, "vidsrc");
    });

    await waitFor(() => {
      expect(result.current.status).toBe("playing");
    });

    expect(result.current.result?.providerId).toBe("vixsrc");
    expect(playbackFetches.filter((id) => id === "vidsrc").length).toBe(1);
    expect(
      playbackFetches.filter((id) => id === "flixhq").length,
    ).toBeGreaterThan(0);
    expect(
      playbackFetches.filter((id) => id === "vixsrc").length,
    ).toBeGreaterThan(0);
  });

  it("uses a warmed fallback when the pinned provider scrape fails", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (_url, init) => {
      const providerId = parseProviderId(init);

      if (providerId === "vidsrc") {
        return failureResponse();
      }

      return successResponse(providerId);
    });

    const { result } = createHook();

    act(() => {
      result.current.switchToProvider({ tmdbId: 2 }, "vidsrc");
    });

    await waitFor(() => {
      expect(result.current.status).toBe("playing");
    });

    expect(result.current.result?.providerId).toBe("vixsrc");
  });

  it("errors when pinned provider fails and no warmed fallback exists", async () => {
    const onAllProvidersFailed = vi.fn();
    globalThis.fetch = vi
      .fn()
      .mockImplementation(async () => failureResponse());

    const { result } = createHook(["vidsrc"], onAllProvidersFailed);

    act(() => {
      result.current.switchToProvider({ tmdbId: 3 }, "vidsrc");
    });

    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });

    expect(result.current.result).toBeNull();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(onAllProvidersFailed).toHaveBeenCalledTimes(1);
  });

  it("races remaining sources when the pinned scrape fails before harvest warms", async () => {
    let resolveVixsrc: (() => void) | undefined;
    const vixsrcReady = new Promise<void>((resolve) => {
      resolveVixsrc = resolve;
    });
    const onAllProvidersFailed = vi.fn();

    globalThis.fetch = vi.fn().mockImplementation(async (_url, init) => {
      const providerId = parseProviderId(init);

      if (providerId === "vidsrc") {
        return failureResponse();
      }

      await vixsrcReady;
      return successResponse(providerId);
    });

    const { result } = createHook(["vidsrc", "vixsrc"], onAllProvidersFailed);

    act(() => {
      result.current.switchToProvider({ tmdbId: 6 }, "vidsrc");
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.status).not.toBe("error");
    expect(onAllProvidersFailed).not.toHaveBeenCalled();

    resolveVixsrc?.();

    await waitFor(() => {
      expect(result.current.status).toBe("playing");
    });

    expect(result.current.result?.providerId).toBe("vixsrc");
    expect(onAllProvidersFailed).not.toHaveBeenCalled();
  });

  it("falls back to earlier sources when the last pinned provider fails", async () => {
    const onAllProvidersFailed = vi.fn();

    globalThis.fetch = vi.fn().mockImplementation(async (_url, init) => {
      const providerId = parseProviderId(init);

      if (providerId === "flixhq") {
        return failureResponse();
      }

      return successResponse(providerId);
    });

    const { result } = createHook(undefined, onAllProvidersFailed);

    act(() => {
      result.current.switchToProvider({ tmdbId: 7 }, "flixhq");
    });

    await waitFor(() => {
      expect(result.current.status).toBe("playing");
    });

    expect(result.current.result?.providerId).not.toBe("flixhq");
    expect(onAllProvidersFailed).not.toHaveBeenCalled();
  });

  it("resumeScraping wraps to remaining sources after the last provider fails", async () => {
    let releaseOthers: (() => void) | undefined;
    const othersReady = new Promise<void>((resolve) => {
      releaseOthers = resolve;
    });
    const onAllProvidersFailed = vi.fn();

    globalThis.fetch = vi.fn().mockImplementation(async (_url, init) => {
      const providerId = parseProviderId(init);

      if (providerId === "flixhq") {
        return successResponse("flixhq");
      }

      await othersReady;
      return successResponse(providerId);
    });

    const { result } = createHook(undefined, onAllProvidersFailed);

    act(() => {
      result.current.switchToProvider({ tmdbId: 8 }, "flixhq");
    });

    await waitFor(() => {
      expect(result.current.status).toBe("playing");
      expect(result.current.result?.providerId).toBe("flixhq");
    });

    act(() => {
      result.current.resumeScraping({ tmdbId: 8 }, "flixhq", "Playback failed");
    });

    expect(onAllProvidersFailed).not.toHaveBeenCalled();

    releaseOthers?.();

    await waitFor(() => {
      expect(result.current.status).toBe("playing");
      expect(result.current.result?.providerId).not.toBe("flixhq");
    });

    expect(
      result.current.items.find((item) => item.providerId === "flixhq")?.status,
    ).toBe("skipped");

    expect(onAllProvidersFailed).not.toHaveBeenCalled();
  });

  it("resumeScraping prefers a warmed provider over cold scraping", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (_url, init) => {
      const providerId = parseProviderId(init);
      return successResponse(providerId);
    });

    const { result } = createHook();

    act(() => {
      result.current.switchToProvider({ tmdbId: 4 }, "vidsrc");
    });

    await waitFor(() => {
      expect(result.current.status).toBe("playing");
    });

    const fetchCountBeforeResume = vi.mocked(globalThis.fetch).mock.calls
      .length;

    act(() => {
      result.current.resumeScraping({ tmdbId: 4 }, "vidsrc", "Playback failed");
    });

    await waitFor(() => {
      expect(result.current.status).toBe("playing");
      expect(result.current.result?.providerId).toBe("vixsrc");
    });

    expect(
      result.current.items.find((item) => item.providerId === "vidsrc")?.status,
    ).toBe("skipped");

    const fetchCountAfterResume = vi.mocked(globalThis.fetch).mock.calls.length;
    expect(fetchCountAfterResume).toBe(fetchCountBeforeResume);
  });

  it("does not swap the active stream when background harvest completes", async () => {
    let resolveFlixhq: (() => void) | undefined;
    const flixhqReady = new Promise<void>((resolve) => {
      resolveFlixhq = resolve;
    });

    globalThis.fetch = vi.fn().mockImplementation(async (_url, init) => {
      const providerId = parseProviderId(init);

      if (providerId === "vidsrc") {
        return successResponse("vidsrc");
      }

      if (providerId === "flixhq") {
        await flixhqReady;
        return successResponse("flixhq");
      }

      return successResponse(providerId);
    });

    const { result } = createHook();

    act(() => {
      result.current.switchToProvider({ tmdbId: 5 }, "vidsrc");
    });

    await waitFor(() => {
      expect(result.current.status).toBe("playing");
      expect(result.current.result?.providerId).toBe("vidsrc");
    });

    resolveFlixhq?.();

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    expect(result.current.status).toBe("playing");
    expect(result.current.result?.providerId).toBe("vidsrc");
  });
});
