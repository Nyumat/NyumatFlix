import { Movie, TvShow } from "@/utils/typings";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import SearchResults, { ContentGrid } from "@/components/search/search-results";

interface MockResponse {
  ok: boolean;
  json: () => Promise<unknown>;
}

const mockFetchResponse = (data: unknown): MockResponse => {
  return {
    ok: true,
    json: async () => data,
  };
};

const originalFetch = global.fetch;
beforeEach(() => {
  global.fetch = vi.fn((url) => {
    if (url.toString().includes("/api/search")) {
      return Promise.resolve(
        mockFetchResponse({
          results: [mockMovie, mockTvShow],
          total_results: 2,
          total_pages: 1,
        }),
      );
    }

    if (url.toString().includes("/api/genres")) {
      return Promise.resolve(
        mockFetchResponse({
          genres: [
            { id: 28, name: "Action" },
            { id: 12, name: "Adventure" },
            { id: 16, name: "Animation" },
          ],
        }),
      );
    }

    if (
      url.toString().includes("/api/movies/") &&
      url.toString().includes("/recommendations")
    ) {
      return Promise.resolve(
        mockFetchResponse({
          results: [
            {
              id: 789,
              title: "Recommended Movie",
              poster_path: "/rec-movie.jpg",
              genre_ids: [28, 12],
              vote_average: 8.0,
              release_date: "2023-05-01",
            },
          ],
        }),
      );
    } else if (
      url.toString().includes("/api/tv/") &&
      url.toString().includes("/recommendations")
    ) {
      return Promise.resolve(
        mockFetchResponse({
          results: [
            {
              id: 987,
              name: "Recommended Show",
              poster_path: "/rec-show.jpg",
              genre_ids: [16],
              vote_average: 7.8,
              first_air_date: "2023-06-01",
            },
          ],
        }),
      );
    } else if (url.toString().includes("/api/movies/")) {
      return Promise.resolve(
        mockFetchResponse({
          id: 123,
          title: "Test Movie",
          runtime: 120,
          genres: [
            { id: 28, name: "Action" },
            { id: 12, name: "Adventure" },
          ],
        }),
      );
    } else if (url.toString().includes("/api/tv/")) {
      return Promise.resolve(
        mockFetchResponse({
          id: 456,
          name: "Test Show",
          origin_country: ["US"],
          genres: [{ id: 16, name: "Animation" }],
        }),
      );
    }

    return Promise.resolve(mockFetchResponse({}));
  }) as unknown as typeof global.fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
});

const mockMovie = {
  id: 123,
  title: "Test Movie",
  media_type: "movie",
  poster_path: "/test.jpg",
  genre_ids: [28, 12],
  vote_average: 7.5,
  release_date: "2023-01-01",
  backdrop_path: "/backdrop.jpg",
  name: "",
  original_language: "en",
  overview: "A test movie description",
  popularity: 100,
  vote_count: 500,
  adult: false,
  video: false,
  original_title: "Test Movie Original",
  first_air_date: "",
};

const mockTvShow = {
  id: 456,
  name: "Test Show",
  media_type: "tv",
  poster_path: "/test2.jpg",
  genre_ids: [16],
  vote_average: 8.0,
  first_air_date: "2023-02-01",
  backdrop_path: "/backdrop2.jpg",
  origin_country: ["US"],
  original_language: "en",
  original_name: "Test Show Original",
  overview: "A test TV show description",
  popularity: 95,
  vote_count: 300,
};

const mockItems: (Movie | TvShow)[] = [mockMovie, mockTvShow];

const mockGenres = { 28: "Action", 12: "Adventure", 16: "Animation" };

describe("ContentGrid Component", () => {
  test("renders the title correctly", async () => {
    await act(async () => {
      render(
        <ContentGrid
          title="Test Results"
          items={mockItems}
          currentPage={1}
          totalPages={1}
          genres={mockGenres}
        />,
      );
    });

    expect(screen.getByText("Test Results")).toBeInTheDocument();
  });

  test("renders the correct number of items", async () => {
    await act(async () => {
      render(
        <ContentGrid
          title="Test Results"
          items={mockItems}
          currentPage={1}
          totalPages={1}
          genres={mockGenres}
        />,
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Test Movie")).toBeInTheDocument();
      expect(screen.getByText("Test Show")).toBeInTheDocument();
    });

    expect(screen.getAllByRole("img")).toHaveLength(2);
  });

  test("renders pagination info when there are multiple pages", async () => {
    await act(async () => {
      render(
        <ContentGrid
          title="Test Results"
          items={mockItems}
          currentPage={1}
          totalPages={3}
          genres={mockGenres}
        />,
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    });
  });

  test("hides pagination info when there is only one page", async () => {
    await act(async () => {
      render(
        <ContentGrid
          title="Test Results"
          items={mockItems}
          currentPage={1}
          totalPages={1}
          genres={mockGenres}
        />,
      );
    });

    await waitFor(() => {
      expect(screen.queryByText("Page 1 of 1")).not.toBeInTheDocument();
    });
  });
});

describe("SearchResults Component", () => {
  test("renders search results with fetched data", async () => {
    await act(async () => {
      render(<SearchResults query="test" />);
    });

    await waitFor(() => {
      expect(screen.getByText("Test Movie")).toBeInTheDocument();
      expect(screen.getByText("Test Show")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Search Results for "test"/i),
      ).toBeInTheDocument();
    });
  });

  test("renders empty state for empty query", async () => {
    await act(async () => {
      render(<SearchResults query="" />);
    });

    await waitFor(() => {
      expect(
        screen.getByText("Please enter a search query."),
      ).toBeInTheDocument();
    });
  });

  test("renders empty state for whitespace-only query", async () => {
    await act(async () => {
      render(<SearchResults query="   " />);
    });

    await waitFor(() => {
      expect(
        screen.getByText("Please enter a search query."),
      ).toBeInTheDocument();
    });
  });

  test("renders no results message when search returns empty", async () => {
    global.fetch = vi.fn((url) => {
      if (url.toString().includes("/api/search")) {
        return Promise.resolve(
          mockFetchResponse({
            results: [],
            total_results: 0,
            total_pages: 0,
          }),
        );
      }
      if (url.toString().includes("/api/genres")) {
        return Promise.resolve(
          mockFetchResponse({
            genres: [
              { id: 28, name: "Action" },
              { id: 12, name: "Adventure" },
              { id: 16, name: "Animation" },
            ],
          }),
        );
      }
      return Promise.resolve(mockFetchResponse({}));
    }) as unknown as typeof global.fetch;

    await act(async () => {
      render(<SearchResults query="nonexistent" />);
    });

    await waitFor(() => {
      expect(
        screen.getByText(/No results found for "nonexistent"/i),
      ).toBeInTheDocument();
    });
  });

  test("handles pagination correctly", async () => {
    global.fetch = vi.fn((url) => {
      if (url.toString().includes("/api/search")) {
        return Promise.resolve(
          mockFetchResponse({
            results: [mockMovie, mockTvShow],
            total_results: 60,
            total_pages: 3,
          }),
        );
      }
      if (url.toString().includes("/api/genres")) {
        return Promise.resolve(
          mockFetchResponse({
            genres: [
              { id: 28, name: "Action" },
              { id: 12, name: "Adventure" },
              { id: 16, name: "Animation" },
            ],
          }),
        );
      }
      return Promise.resolve(mockFetchResponse({}));
    }) as unknown as typeof global.fetch;

    await act(async () => {
      render(<SearchResults query="test" />);
    });

    // Check initial state
    await waitFor(() => {
      expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    });

    // Check that pagination controls are rendered
    expect(screen.getByText("Previous")).toBeInTheDocument();
    expect(screen.getByText("Next")).toBeInTheDocument();
  });

  test("displays genre filter when genres are available", async () => {
    // Mock genres API
    global.fetch = vi.fn((url) => {
      if (url.toString().includes("/api/search")) {
        return Promise.resolve(
          mockFetchResponse({
            results: [mockMovie, mockTvShow],
            total_results: 2,
            total_pages: 1,
          }),
        );
      }
      if (url.toString().includes("/api/genres")) {
        return Promise.resolve(
          mockFetchResponse({
            genres: [
              { id: 28, name: "Action" },
              { id: 12, name: "Adventure" },
              { id: 16, name: "Animation" },
            ],
          }),
        );
      }
      return Promise.resolve(mockFetchResponse({}));
    }) as unknown as typeof global.fetch;

    await act(async () => {
      render(<SearchResults query="test" />);
    });

    await waitFor(() => {
      expect(screen.getByText("Filter by Genre")).toBeInTheDocument();
    });
  });
});
