import { AggressivePrefetchProvider } from "@/components/providers/aggressive-prefetch-provider";
import { EnhancedLink } from "@/components/ui/enhanced-link";
import { MediaItem } from "@/utils/typings";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

// Sample media item for testing
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
  origin_country: [],
  original_language: "en",
  original_name: "",
  overview: "A test movie description",
  popularity: 100,
  vote_count: 500,
  adult: false,
  video: false,
  original_title: "Test Movie Original",
  first_air_date: "",
} satisfies MediaItem;

describe("Prefetching System", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock global fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
  });

  describe("EnhancedLink Component", () => {
    test("should render as a link with correct href", () => {
      render(
        <EnhancedLink href="/movies/123" mediaItem={mockMovie}>
          Test Link
        </EnhancedLink>,
      );

      const link = screen.getByRole("link");
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "/movies/123");
      expect(screen.getByText("Test Link")).toBeInTheDocument();
    });

    test("should render with movie mediaItem", () => {
      render(
        <EnhancedLink href="/movies/123" mediaItem={mockMovie}>
          Test Movie Link
        </EnhancedLink>,
      );

      expect(screen.getByText("Test Movie Link")).toBeInTheDocument();
    });

    test("should render with TV show href pattern", () => {
      render(<EnhancedLink href="/tvshows/789">Test TV Link</EnhancedLink>);

      const link = screen.getByRole("link");
      expect(link).toHaveAttribute("href", "/tvshows/789");
      expect(screen.getByText("Test TV Link")).toBeInTheDocument();
    });

    test("should handle noPrefetch prop", () => {
      render(
        <EnhancedLink href="/movies/123" noPrefetch={true}>
          No Prefetch Link
        </EnhancedLink>,
      );

      const link = screen.getByRole("link");
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "/movies/123");
    });

    test("should handle mouse events without errors", () => {
      render(
        <EnhancedLink href="/movies/123" mediaItem={mockMovie}>
          Interactive Link
        </EnhancedLink>,
      );

      const link = screen.getByRole("link");

      // These should not throw errors
      fireEvent.mouseEnter(link);
      fireEvent.mouseLeave(link);

      expect(link).toBeInTheDocument();
    });

    test("should pass through additional props", () => {
      render(
        <EnhancedLink
          href="/movies/123"
          className="custom-class"
          data-testid="enhanced-link"
        >
          Custom Link
        </EnhancedLink>,
      );

      const link = screen.getByTestId("enhanced-link");
      expect(link).toHaveClass("custom-class");
    });
  });

  describe("AggressivePrefetchProvider", () => {
    test("should render children without errors", () => {
      render(
        <AggressivePrefetchProvider>
          <div>Child Component</div>
        </AggressivePrefetchProvider>,
      );

      expect(screen.getByText("Child Component")).toBeInTheDocument();
    });

    test("should handle items prop", () => {
      render(
        <AggressivePrefetchProvider items={[mockMovie]}>
          <div>Child with Items</div>
        </AggressivePrefetchProvider>,
      );

      expect(screen.getByText("Child with Items")).toBeInTheDocument();
    });

    test("should handle enableImmediate prop", () => {
      render(
        <AggressivePrefetchProvider enableImmediate={true}>
          <div>Immediate Prefetch Child</div>
        </AggressivePrefetchProvider>,
      );

      expect(screen.getByText("Immediate Prefetch Child")).toBeInTheDocument();
    });

    test("should handle disabled prefetching", () => {
      render(
        <AggressivePrefetchProvider
          enableImmediate={false}
          enableHover={false}
          enableIntersection={false}
        >
          <div>Disabled Prefetch Child</div>
        </AggressivePrefetchProvider>,
      );

      expect(screen.getByText("Disabled Prefetch Child")).toBeInTheDocument();
    });
  });

  describe("Media Type Detection", () => {
    test("should handle movie URLs correctly", () => {
      render(<EnhancedLink href="/movies/456">Movie Link</EnhancedLink>);

      const link = screen.getByRole("link");
      expect(link).toHaveAttribute("href", "/movies/456");
    });

    test("should handle TV show URLs correctly", () => {
      render(<EnhancedLink href="/tvshows/789">TV Show Link</EnhancedLink>);

      const link = screen.getByRole("link");
      expect(link).toHaveAttribute("href", "/tvshows/789");
    });

    test("should handle non-media URLs", () => {
      render(<EnhancedLink href="/home">Home Link</EnhancedLink>);

      const link = screen.getByRole("link");
      expect(link).toHaveAttribute("href", "/home");
    });
  });

  describe("Component Integration", () => {
    test("should work together - provider with enhanced links", () => {
      render(
        <AggressivePrefetchProvider items={[mockMovie]}>
          <div>
            <EnhancedLink href="/movies/123" mediaItem={mockMovie}>
              Movie Link
            </EnhancedLink>
            <EnhancedLink href="/tvshows/456">TV Link</EnhancedLink>
          </div>
        </AggressivePrefetchProvider>,
      );

      expect(screen.getByText("Movie Link")).toBeInTheDocument();
      expect(screen.getByText("TV Link")).toBeInTheDocument();

      const movieLink = screen.getByText("Movie Link").closest("a");
      const tvLink = screen.getByText("TV Link").closest("a");

      expect(movieLink).toHaveAttribute("href", "/movies/123");
      expect(tvLink).toHaveAttribute("href", "/tvshows/456");
    });
  });
});
