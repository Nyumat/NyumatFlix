import { useSearchPreview } from "@/hooks/use-search-preview";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

describe("useSearchPreview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  test("returns empty results initially", () => {
    const { result } = renderHook(() => useSearchPreview(""));

    expect(result.current.results).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  test("does not fetch for queries shorter than 2 characters", async () => {
    const { result } = renderHook(() => useSearchPreview("a"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.results).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  test("does not fetch for empty or whitespace-only queries", async () => {
    const { result, rerender } = renderHook(
      ({ query }) => useSearchPreview(query),
      { initialProps: { query: "   " } },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.results).toEqual([]);

    act(() => {
      rerender({ query: "" });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("fetches search preview results after debounce delay", async () => {
    const mockResults = [
      {
        id: 1,
        title: "Test Movie",
        poster_path: "/test.jpg",
        media_type: "movie",
      },
      {
        id: 2,
        name: "Test Show",
        poster_path: "/test2.jpg",
        media_type: "tv",
      },
    ];

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: mockResults }),
    } as Response);

    const { result } = renderHook(() => useSearchPreview("test"));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.results).toEqual([]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
      await Promise.resolve();
    });

    expect(result.current.results).toEqual(mockResults);
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/search-preview?query=test",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  test("shows loading state during fetch", async () => {
    let resolveFetch: (value: unknown) => void;
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });

    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      fetchPromise as Promise<Response>,
    );

    const { result } = renderHook(() => useSearchPreview("test"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveFetch!({
        ok: true,
        json: async () => ({ results: [] }),
      });
      await Promise.resolve();
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("handles API errors gracefully", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);

    const { result } = renderHook(() => useSearchPreview("test"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
      await Promise.resolve();
    });

    expect(result.current.results).toEqual([]);
    expect(result.current.error).toBe("Failed to load search suggestions");
    expect(result.current.isLoading).toBe(false);
  });

  test("handles network errors", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Network error"),
    );

    const { result } = renderHook(() => useSearchPreview("test"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
      await Promise.resolve();
    });

    expect(result.current.results).toEqual([]);
    expect(result.current.error).toBe("Failed to load search suggestions");
    expect(result.current.isLoading).toBe(false);
  });

  test("debounces multiple rapid query changes", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    } as Response);

    const { rerender } = renderHook(({ query }) => useSearchPreview(query), {
      initialProps: { query: "te" },
    });

    act(() => {
      rerender({ query: "tes" });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    act(() => {
      rerender({ query: "test" });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
      await Promise.resolve();
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/search-preview?query=test",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  test("cancels pending fetch when query changes", async () => {
    let resolveFirstFetch: (value: unknown) => void;
    const firstFetchPromise = new Promise((resolve) => {
      resolveFirstFetch = resolve;
    });

    (global.fetch as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(firstFetchPromise as Promise<Response>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [{ id: 2, title: "New Result" }] }),
      } as Response);

    const { result, rerender } = renderHook(
      ({ query }) => useSearchPreview(query),
      { initialProps: { query: "first" } },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(result.current.isLoading).toBe(true);

    act(() => {
      rerender({ query: "second" });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
      await Promise.resolve();
    });

    expect(result.current.results).toEqual([{ id: 2, title: "New Result" }]);

    await act(async () => {
      resolveFirstFetch!({
        ok: true,
        json: async () => ({ results: [{ id: 1, title: "First Result" }] }),
      });
      await Promise.resolve();
    });

    expect(result.current.results).toEqual([{ id: 2, title: "New Result" }]);
  });

  test("clears results immediately when query becomes empty", async () => {
    const mockResults = [
      {
        id: 1,
        title: "Test Movie",
        poster_path: "/test.jpg",
        media_type: "movie",
      },
    ];

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: mockResults }),
    } as Response);

    const { result, rerender } = renderHook(
      ({ query }) => useSearchPreview(query),
      { initialProps: { query: "test" } },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
      await Promise.resolve();
    });

    expect(result.current.results).toEqual(mockResults);

    act(() => {
      rerender({ query: "" });
    });

    expect(result.current.results).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  test("uses custom debounce delay", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [] }),
    } as Response);

    renderHook(() => useSearchPreview("test", 500));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(global.fetch).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
      await Promise.resolve();
    });

    expect(global.fetch).toHaveBeenCalled();
  });

  test("handles missing results in response", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as Response);

    const { result } = renderHook(() => useSearchPreview("test"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
      await Promise.resolve();
    });

    expect(result.current.results).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });
});
