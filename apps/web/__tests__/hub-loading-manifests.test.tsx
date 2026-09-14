import {
  AnimeHubLoadingSections,
  HomeHubLoadingSections,
  MoviesDiscoverHubLoadingSections,
  TrendingHubLoadingSections,
  TvDiscoverHubLoadingSections,
} from "@/components/catalog/hub-loading-manifests";
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

describe("hub loading manifests", () => {
  test("home manifest includes hero, providers, and collections slots", () => {
    render(<HomeHubLoadingSections />);

    expect(screen.getByTestId("home-hub-section-hero")).toBeInTheDocument();
    expect(
      screen.getByTestId("home-hub-section-providers"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("home-hub-section-collections"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("home-hub-section-showcase")).toBeInTheDocument();
  });

  test("movies discover hub manifest order", () => {
    render(<MoviesDiscoverHubLoadingSections />);

    expect(screen.getByTestId("movies-hub-section-hero")).toBeInTheDocument();
    expect(
      screen.getByTestId("movies-hub-section-top-rated"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("movies-hub-section-showcase"),
    ).toBeInTheDocument();
  });

  test("tv discover hub manifest order", () => {
    render(<TvDiscoverHubLoadingSections />);

    expect(screen.getByTestId("tv-hub-section-hero")).toBeInTheDocument();
    expect(screen.getByTestId("tv-hub-section-trending")).toBeInTheDocument();
  });

  test("anime hub manifest includes chrome and ranked slot", () => {
    render(<AnimeHubLoadingSections />);

    expect(screen.getByTestId("anime-hub-section-chrome")).toBeInTheDocument();
    expect(screen.getByTestId("anime-hub-section-ranked")).toBeInTheDocument();
  });

  test("trending hub manifest sections", () => {
    render(<TrendingHubLoadingSections />);

    expect(
      screen.getByTestId("trending-hub-section-movies"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("trending-hub-section-tv")).toBeInTheDocument();
    expect(
      screen.getByTestId("trending-hub-section-people"),
    ).toBeInTheDocument();
  });
});
