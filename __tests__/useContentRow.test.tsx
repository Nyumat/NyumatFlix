import { useContentRow } from "@/hooks/useContentRow";
import { MediaItem } from "@/utils/typings";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

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

describe("useContentRow", () => {
  const originalConsoleError = console.error;

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    console.error = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
    console.error = originalConsoleError;
  });

  test("starts in loading state", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response);

    const { result } = renderHook(
      () => useContentRow({ rowId: "test-row", count: 20 }),
      { wrapper: createWrapper() },
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.items).toEqual([]);
    expect(result.current.error).toBeNull();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  test("fetches content row successfully", async () => {
    const mockItems: MediaItem[] = [
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
    ] as MediaItem[];

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockItems,
    } as Response);

    const { result } = renderHook(
      () => useContentRow({ rowId: "test-row", count: 20 }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.items).toEqual(mockItems);
    expect(result.current.error).toBeNull();
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/content-rows?id=test-row&count=20&enrich=false",
    );
  });

  test("includes enrich parameter when enabled", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response);

    renderHook(
      () => useContentRow({ rowId: "test-row", count: 20, enrich: true }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/content-rows?id=test-row&count=20&enrich=true",
      );
    });
  });

  test("does not fetch when hide is true", async () => {
    const { result } = renderHook(
      () => useContentRow({ rowId: "test-row", count: 20, hide: true }),
      { wrapper: createWrapper() },
    );

    // With TanStack Query, when enabled: false, it's not loading
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.items).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  test("handles API errors gracefully", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    } as Response);

    const { result } = renderHook(
      () => useContentRow({ rowId: "test-row", count: 20 }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.items).toEqual([]);
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toContain("500");
  });

  test("handles network errors", async () => {
    const networkError = new Error("Network error");
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      networkError,
    );

    const { result } = renderHook(
      () => useContentRow({ rowId: "test-row", count: 20 }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.items).toEqual([]);
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe("Network error");
  });

  test("uses default count of 20 when not provided", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response);

    renderHook(() => useContentRow({ rowId: "test-row" }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/content-rows?id=test-row&count=20&enrich=false",
      );
    });
  });

  test("handles malformed JSON response", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => {
        throw new Error("Invalid JSON");
      },
    } as unknown as Response);

    const { result } = renderHook(
      () => useContentRow({ rowId: "test-row", count: 20 }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
  });
});
