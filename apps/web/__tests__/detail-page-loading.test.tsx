import {
  DetailPageLoading,
  MovieDetailTabPanelsLoading,
  TvDetailTabPanelsLoading,
} from "@/components/layout/page-loading/detail-page-loading";
import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, test, vi } from "vitest";

beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {
      return undefined;
    }
    unobserve() {
      return undefined;
    }
    disconnect() {
      return undefined;
    }
  };

  if (typeof Element !== "undefined") {
    Element.prototype.scrollTo = vi.fn();
  }
});

describe("detail page loading skeletons", () => {
  test("movie panels mirror Overview, Cast, and You Might Like", () => {
    render(<MovieDetailTabPanelsLoading />);

    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Cast")).toBeInTheDocument();
    expect(screen.getByText("You Might Like")).toBeInTheDocument();
  });

  test("tv panels mirror Episodes, Cast, You Might Like, and Series Graph", () => {
    render(<TvDetailTabPanelsLoading />);

    expect(screen.getByText("Seasons & Episodes")).toBeInTheDocument();
    expect(screen.getByText("Cast")).toBeInTheDocument();
    expect(screen.getByText("You Might Like")).toBeInTheDocument();
    expect(screen.getByText("Series Graph")).toBeInTheDocument();
  });

  test("skeletons use the shared shimmer instead of flat blocks", () => {
    const { container } = render(<MovieDetailTabPanelsLoading />);

    expect(
      container.querySelectorAll(".animate-shimmer").length,
    ).toBeGreaterThan(0);
  });

  test("detail hero skeleton stays minimal: logo block and one action bar", () => {
    const { container } = render(<DetailPageLoading mediaType="movie" />);
    const hero = container.querySelector(".h-\\[100svh\\]");

    expect(hero).toHaveClass("min-h-[34rem]");
    expect(hero?.querySelectorAll(".animate-shimmer").length).toBe(3);
    expect(hero?.querySelectorAll(".rounded-full.animate-shimmer").length).toBe(
      1,
    );
  });
});
