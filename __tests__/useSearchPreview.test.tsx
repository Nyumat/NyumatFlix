import { useSearchPreview } from "@/hooks/use-search-preview";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Create a wrapper with a fresh QueryClient for each test
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
};

describe("useSearchPreview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("returns empty results initially", () => {
    const { result } = renderHook(() => useSearchPreview(""), {
      wrapper: createWrapper(),
    });

    expect(result.current.results).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  test("does not fetch for queries shorter than 2 characters", async () => {
    const { result } = renderHook(() => useSearchPreview("a"), {
      wrapper: createWrapper(),
    });

    // With enabled: false, query won't run
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.results).toEqual([]);
  });

  test("does not fetch for empty or whitespace-only queries", async () => {
    const { result } = renderHook(() => useSearchPreview("   "), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.results).toEqual([]);
  });

  test("fetches search preview results", async () => {
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

    const { result } = renderHook(() => useSearchPreview("test"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.results).toEqual(mockResults);
    expect(result.current.error).toBeNull();
  });

  test("handles API errors gracefully", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);

    const { result } = renderHook(() => useSearchPreview("test"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.results).toEqual([]);
    expect(result.current.error).toBe("Failed to load search suggestions");
  });

  test("handles network errors", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Network error"),
    );

    const { result } = renderHook(() => useSearchPreview("test"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.results).toEqual([]);
    expect(result.current.error).toBe("Failed to load search suggestions");
  });

  test("handles missing results in response", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as Response);

    const { result } = renderHook(() => useSearchPreview("test"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.results).toEqual([]);
  });
});
