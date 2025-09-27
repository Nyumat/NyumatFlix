import { MediaContentGrid } from "@/components/content/media-content-grid";
import SearchResults from "@/components/search/search-results";
import { GlobalDockProvider } from "@/components/ui/global-dock";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Movie, TvShow } from "@/utils/typings";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {
      return vi.fn();
    }
    unobserve() {
      return vi.fn();
    }
    disconnect() {
      return vi.fn();
    }
  };

  global.matchMedia = vi.fn().mockImplementation(() => ({
    matches: false,
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }));

  Element.prototype.scrollIntoView = vi.fn();
});

const mockFetchResponse = (data: unknown) => ({
  ok: true,
  json: async () => data,
});

const mockMovie: Movie = {
  id: 123,
  title: "Test Movie",
  poster_path: "/test.jpg",
  genre_ids: [28, 12],
  vote_average: 7.5,
  release_date: "2023-01-01",
  backdrop_path: "/backdrop.jpg",
  media_type: "movie",
  adult: false,
  original_language: "en",
  original_title: "Test Movie",
  overview: "A test movie",
  popularity: 100,
  video: false,
  vote_count: 500,
};

const mockTvShow: TvShow = {
  id: 456,
  name: "Test Show",
  poster_path: "/test2.jpg",
  genre_ids: [16],
  vote_average: 8.0,
  first_air_date: "2023-02-01",
  backdrop_path: "/backdrop2.jpg",
  media_type: "tv",
  origin_country: ["US"],
  original_language: "en",
  original_name: "Test Show",
  overview: "A test show",
  popularity: 95,
  vote_count: 300,
};

beforeEach(() => {
  global.fetch = vi.fn((url) => {
    const urlString = url.toString();

    if (urlString.includes("/api/search")) {
      return Promise.resolve(
        mockFetchResponse({
          media: [mockMovie, mockTvShow],
          people: [],
          page: 1,
          totalResults: 2,
          totalPages: 1,
        }),
      );
    }

    if (urlString.includes("/api/genres")) {
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
});

afterEach(() => {
  vi.clearAllMocks();
});

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <GlobalDockProvider>
      <TooltipProvider>{component}</TooltipProvider>
    </GlobalDockProvider>,
  );
};

describe("SearchResults Component", () => {
  test("displays search results for valid query", async () => {
    renderWithProviders(<SearchResults query="test" />);

    await waitFor(() => {
      expect(screen.getByText("Test Movie")).toBeInTheDocument();
      expect(screen.getByText("Test Show")).toBeInTheDocument();
    });

    expect(screen.getByText(/Results for "test"/)).toBeInTheDocument();
  });

  test("shows empty state message for empty query", async () => {
    renderWithProviders(<SearchResults query="" />);

    await waitFor(() => {
      expect(
        screen.getByText("Please enter a search query."),
      ).toBeInTheDocument();
    });
  });

  test("shows no results message when search returns empty", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(
        mockFetchResponse({
          media: [],
          people: [],
          page: 1,
          totalResults: 0,
          totalPages: 0,
        }),
      ),
    ) as unknown as typeof global.fetch;

    renderWithProviders(<SearchResults query="nonexistent" />);

    await waitFor(() => {
      expect(
        screen.getByText(/No results found for "nonexistent"/),
      ).toBeInTheDocument();
    });
  });

  test("displays loading state", async () => {
    let resolveSearch: (value: unknown) => void;
    const searchPromise = new Promise((resolve) => {
      resolveSearch = resolve;
    });

    global.fetch = vi.fn((url) => {
      if (url.toString().includes("/api/search")) return searchPromise;
      return Promise.resolve(mockFetchResponse({ genres: [] }));
    }) as unknown as typeof global.fetch;

    renderWithProviders(<SearchResults query="test" />);

    expect(
      screen.getByText(/Loading search results for "test"/),
    ).toBeInTheDocument();

    await act(async () => {
      resolveSearch!(
        mockFetchResponse({
          media: [mockMovie],
          people: [],
          page: 1,
          totalResults: 1,
          totalPages: 1,
        }),
      );
    });

    await waitFor(() => {
      expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
      expect(screen.getByText("Test Movie")).toBeInTheDocument();
    });
  });

  test("handles API errors gracefully", async () => {
    global.fetch = vi.fn((url) => {
      const urlString = url.toString();

      if (urlString.includes("/api/search")) {
        return Promise.reject(new Error("Network error"));
      }

      if (urlString.includes("/api/genres")) {
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

    renderWithProviders(<SearchResults query="test" />);

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });

  test("shows pagination when there are multiple pages", async () => {
    global.fetch = vi.fn((url) => {
      if (url.toString().includes("/api/search")) {
        return Promise.resolve(
          mockFetchResponse({
            media: [mockMovie, mockTvShow],
            people: [],
            page: 1,
            totalResults: 60,
            totalPages: 3,
          }),
        );
      }
      return Promise.resolve(mockFetchResponse({ genres: [] }));
    }) as unknown as typeof global.fetch;

    renderWithProviders(<SearchResults query="test" />);

    await waitFor(() => {
      expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();

      expect(
        screen.getByRole("link", { name: /previous/i }),
      ).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /next/i })).toBeInTheDocument();
    });
  });

  test("can navigate between pages", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn((url) => {
      const urlString = url.toString();
      if (urlString.includes("/api/search")) {
        const page = urlString.includes("page=2") ? 2 : 1;
        return Promise.resolve(
          mockFetchResponse({
            media: page === 1 ? [mockMovie] : [mockTvShow],
            people: [],
            page,
            totalResults: 40,
            totalPages: 2,
          }),
        );
      }
      return Promise.resolve(mockFetchResponse({ genres: [] }));
    }) as unknown as typeof global.fetch;

    renderWithProviders(<SearchResults query="test" />);

    await waitFor(() => {
      expect(screen.getByText("Test Movie")).toBeInTheDocument();
    });

    const nextButton = screen.getByRole("link", { name: /next/i });
    await user.click(nextButton);
    await waitFor(() => {
      expect(screen.queryByText("Test Movie")).not.toBeInTheDocument();
      expect(screen.getByText("Test Show")).toBeInTheDocument();
    });
  });

  test("shows genre filter", async () => {
    renderWithProviders(<SearchResults query="test" />);

    await waitFor(() => {
      expect(screen.getByText("Filter by Genre")).toBeInTheDocument();
    });
  });
});

describe("MediaContentGrid Component", () => {
  test("renders media items", async () => {
    const items = [mockMovie, mockTvShow].map((item) => ({
      ...item,
      media_type: "title" in item ? "movie" : ("tv" as const),
      genres: [],
    }));

    renderWithProviders(
      <MediaContentGrid items={items} defaultViewMode="grid" />,
    );

    await waitFor(() => {
      expect(screen.getByText("Test Movie")).toBeInTheDocument();
      expect(screen.getByText("Test Show")).toBeInTheDocument();
    });
  });
});
