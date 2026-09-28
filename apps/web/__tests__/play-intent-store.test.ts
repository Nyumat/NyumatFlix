import { afterEach, describe, expect, it, vi } from "vitest";

import { hasPlayIntent } from "@/lib/playback/detail-autoplay-href";
import { usePlayIntentStore } from "@/lib/stores/play-intent-store";

afterEach(() => {
  usePlayIntentStore.setState({ target: null });
  try {
    sessionStorage.clear();
  } catch {
    // ignore
  }
});

describe("play intent store", () => {
  it("pushes the plain href and records movie intent", async () => {
    const { requestDetailPlay } = await import(
      "@/lib/playback/detail-autoplay-href"
    );
    const pushed: string[] = [];
    requestDetailPlay((href) => pushed.push(href), "/movies/123", {
      mediaType: "movie",
    });

    expect(pushed).toEqual(["/movies/123"]);
    expect(usePlayIntentStore.getState().target).toEqual({
      kind: "movie",
      href: "/movies/123",
    });
    expect(hasPlayIntent("/movies/123")).toBe(true);
  });

  it("records tv eligibility without the autoplay param", async () => {
    const { requestDetailPlay } = await import(
      "@/lib/playback/detail-autoplay-href"
    );
    const pushed: string[] = [];
    requestDetailPlay((href) => pushed.push(href), "/tvshows/1399", {
      mediaType: "tv",
      localCoords: { seasonNumber: 1, episodeNumber: 3 },
    });

    expect(pushed).toEqual(["/tvshows/1399"]);
    expect(usePlayIntentStore.getState().target).toEqual({
      kind: "tv",
      href: "/tvshows/1399",
      eligible: true,
    });
  });

  it("consumes intent exactly once per href", () => {
    usePlayIntentStore
      .getState()
      .requestPlay({ kind: "movie", href: "/movies/123" });

    expect(usePlayIntentStore.getState().consumePlay("/movies/123")).toBe(true);
    expect(usePlayIntentStore.getState().consumePlay("/movies/123")).toBe(
      false,
    );
    expect(hasPlayIntent("/movies/123")).toBe(false);
  });

  it("still honors legacy ?autoplay=true links", () => {
    expect(hasPlayIntent("/movies/123?autoplay=true")).toBe(true);
  });
});
