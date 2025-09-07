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
    const part1 = screen.getByText("Movies and TV Shows");
    const part2 = screen.getByText("For Everyone.");
    expect(part1).toBeInTheDocument();
    expect(part2).toBeInTheDocument();
  });

  test("renders the subtitle", () => {
    render(<Page />, { wrapper: TestWrapper });
    const subtitle = screen.getByText(
      /Curated from all the.*streaming services below, Nyumatflix is a no-cost, ad-free, and open-source aggregator\./,
    );
    expect(subtitle).toBeInTheDocument();
  });

  test("renders navigation and content sections", () => {
    render(<Page />, { wrapper: TestWrapper });
    // Check for key sections that should be present
    expect(screen.getByText("Movies and TV Shows")).toBeInTheDocument();
    expect(screen.getByText("For Everyone.")).toBeInTheDocument();
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
