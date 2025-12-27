import { ThemeProvider } from "@/components/layout/theme-provider";
import { GlobalDockProvider } from "@/components/ui/global-dock";
import { TooltipProvider } from "@/components/ui/tooltip";
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import Page from "../app/page";

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider
    attribute="class"
    defaultTheme="system"
    disableTransitionOnChange
  >
    <GlobalDockProvider>
      <TooltipProvider>{children}</TooltipProvider>
    </GlobalDockProvider>
  </ThemeProvider>
);

describe("Landing Page", () => {
  test("renders the header", () => {
    render(<Page />, { wrapper: TestWrapper });
    const title = screen.getByTestId("hero-title");
    expect(title).toHaveTextContent("Movies and TV Shows");
    expect(title).toHaveTextContent("For Everyone.");
  });

  test("renders navigation and content sections", () => {
    render(<Page />, { wrapper: TestWrapper });
    expect(screen.getByTestId("hero-title")).toBeInTheDocument();
    expect(
      screen.getByTestId("hero-start-watching-button"),
    ).toBeInTheDocument();
  });

  test("renders the search input", () => {
    render(<Page />, { wrapper: TestWrapper });
    const searchInput = screen.getByTestId("hero-search-input");
    expect(searchInput).toBeInTheDocument();
    expect(searchInput).toHaveAttribute(
      "placeholder",
      "Search movies, TV shows...",
    );
  });

  describe("Preview Image", () => {
    test("renders streaming service logos", () => {
      render(<Page />, { wrapper: TestWrapper });
      const peacockLogos = screen.getAllByAltText("Peacock");
      const hboLogos = screen.getAllByAltText("HBO Max");
      expect(peacockLogos.length).toBeGreaterThan(0);
      expect(hboLogos.length).toBeGreaterThan(0);
    });
  });
});
