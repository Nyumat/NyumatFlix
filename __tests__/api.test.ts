import {
  fetchCombinedGenres,
  fetchContentRow,
  fetchMovieGenres,
  fetchSearchPreview,
  fetchSearchResults,
  fetchTvGenres,
  fetchTvSeason,
} from "@/lib/api";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

describe("API functions", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = mockFetch;
    // mock window for fetchSearchResults
    global.window = {
      location: {
        origin: "http://localhost:3000",
      },
    } as unknown as Window & typeof globalThis;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("fetchContentRow", () => {
    test("fetches content row with default parameters", async () => {
      const mockItems = [{ id: 1, title: "Test Movie" }];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockItems,
      } as Response);

      const result = await fetchContentRow("trending-movies");

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/content-rows?id=trending-movies&count=20&enrich=false",
      );
      expect(result).toEqual(mockItems);
    });

    test("fetches content row with custom count", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response);

      await fetchContentRow("trending-movies", 10);

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/content-rows?id=trending-movies&count=10&enrich=false",
      );
    });

    test("fetches content row with enrich enabled", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response);

      await fetchContentRow("trending-movies", 20, true);

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/content-rows?id=trending-movies&count=20&enrich=true",
      );
    });

    test("throws error on failed response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      await expect(fetchContentRow("trending-movies")).rejects.toThrow(
        "Failed to fetch content row: 500",
      );
    });
  });

  describe("fetchSearchPreview", () => {
    test("returns empty array for short queries", async () => {
      const result = await fetchSearchPreview("a");

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    test("returns empty array for empty queries", async () => {
      const result = await fetchSearchPreview("");

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    test("returns empty array for whitespace-only queries", async () => {
      const result = await fetchSearchPreview("   ");

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    test("fetches search preview for valid queries", async () => {
      const mockResults = [{ id: 1, title: "Test", media_type: "movie" }];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: mockResults }),
      } as Response);

      const result = await fetchSearchPreview("test query");

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/search-preview?query=test%20query",
        { signal: undefined },
      );
      expect(result).toEqual(mockResults);
    });

    test("passes abort signal to fetch", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] }),
      } as Response);

      const controller = new AbortController();
      await fetchSearchPreview("test", controller.signal);

      expect(mockFetch).toHaveBeenCalledWith("/api/search-preview?query=test", {
        signal: controller.signal,
      });
    });

    test("throws error on failed response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      await expect(fetchSearchPreview("test")).rejects.toThrow(
        "Search preview failed",
      );
    });

    test("returns empty array when results are missing", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);

      const result = await fetchSearchPreview("test");

      expect(result).toEqual([]);
    });
  });

  describe("fetchSearchResults", () => {
    test("returns empty results for empty query", async () => {
      const result = await fetchSearchResults("");

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result).toEqual({
        media: [],
        people: [],
        page: 1,
        totalPages: 1,
        totalResults: 0,
      });
    });

    test("returns empty results for whitespace-only query", async () => {
      const result = await fetchSearchResults("   ");

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result).toEqual({
        media: [],
        people: [],
        page: 1,
        totalPages: 1,
        totalResults: 0,
      });
    });

    test("fetches search results with default page", async () => {
      const mockResults = {
        media: [{ id: 1, title: "Test" }],
        people: [],
        page: 1,
        totalPages: 10,
        totalResults: 100,
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResults,
      } as Response);

      const result = await fetchSearchResults("test");

      expect(result).toEqual(mockResults);
    });

    test("fetches search results with custom page", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          media: [],
          people: [],
          page: 3,
          totalPages: 10,
          totalResults: 100,
        }),
      } as Response);

      await fetchSearchResults("test", 3);

      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain("page=3");
    });

    test("throws error with message from response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: "Internal Server Error",
        json: async () => ({ error: "Custom error message" }),
      } as Response);

      await expect(fetchSearchResults("test")).rejects.toThrow(
        "Custom error message",
      );
    });

    test("throws error with statusText when no error in response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: "Internal Server Error",
        json: async () => ({}),
      } as Response);

      await expect(fetchSearchResults("test")).rejects.toThrow(
        "Failed to fetch search results: Internal Server Error",
      );
    });
  });

  describe("fetchMovieGenres", () => {
    test("fetches movie genres successfully", async () => {
      const mockGenres = [
        { id: 28, name: "Action" },
        { id: 12, name: "Adventure" },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ genres: mockGenres }),
      } as Response);

      const result = await fetchMovieGenres();

      expect(mockFetch).toHaveBeenCalledWith("/api/genres?type=movie");
      expect(result).toEqual(mockGenres);
    });

    test("returns empty array when genres are missing", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);

      const result = await fetchMovieGenres();

      expect(result).toEqual([]);
    });

    test("throws error on failed response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      await expect(fetchMovieGenres()).rejects.toThrow(
        "Failed to fetch movie genres",
      );
    });
  });

  describe("fetchTvGenres", () => {
    test("fetches TV genres successfully", async () => {
      const mockGenres = [
        { id: 10759, name: "Action & Adventure" },
        { id: 16, name: "Animation" },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ genres: mockGenres }),
      } as Response);

      const result = await fetchTvGenres();

      expect(mockFetch).toHaveBeenCalledWith("/api/genres?type=tv");
      expect(result).toEqual(mockGenres);
    });

    test("returns empty array when genres are missing", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);

      const result = await fetchTvGenres();

      expect(result).toEqual([]);
    });

    test("throws error on failed response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      await expect(fetchTvGenres()).rejects.toThrow(
        "Failed to fetch TV genres",
      );
    });
  });

  describe("fetchCombinedGenres", () => {
    test("combines movie and TV genres into a record", async () => {
      const movieGenres = [
        { id: 28, name: "Action" },
        { id: 12, name: "Adventure" },
      ];
      const tvGenres = [
        { id: 16, name: "Animation" },
        { id: 28, name: "Action" },
      ];

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ genres: movieGenres }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ genres: tvGenres }),
        } as Response);

      const result = await fetchCombinedGenres();

      expect(result).toEqual({
        28: "Action",
        12: "Adventure",
        16: "Animation",
      });
    });

    test("handles empty genre lists", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ genres: [] }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ genres: [] }),
        } as Response);

      const result = await fetchCombinedGenres();

      expect(result).toEqual({});
    });
  });

  describe("fetchTvSeason", () => {
    test("fetches TV season data successfully", async () => {
      const mockSeason = {
        id: 12345,
        name: "Season 1",
        overview: "First season",
        season_number: 1,
        episodes: [
          { id: 1, name: "Episode 1", episode_number: 1 },
          { id: 2, name: "Episode 2", episode_number: 2 },
        ],
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSeason,
      } as Response);

      const result = await fetchTvSeason(100, 1);

      expect(mockFetch).toHaveBeenCalledWith("/api/tv/100/season/1");
      expect(result).toEqual(mockSeason);
    });

    test("throws error on failed response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      await expect(fetchTvSeason(100, 99)).rejects.toThrow(
        "Failed to fetch season 99",
      );
    });
  });
});
