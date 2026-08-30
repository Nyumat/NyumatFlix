import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useValidatedHeroBackdrop } from "@/hooks/use-validated-hero-backdrop";

class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 1920;
  naturalHeight = 1080;
  private _src = "";

  set src(value: string) {
    this._src = value;
    queueMicrotask(() => {
      this.onload?.();
    });
  }

  get src() {
    return this._src;
  }
}

describe("useValidatedHeroBackdrop", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows backdrop optimistically on first paint while validating", async () => {
    vi.stubGlobal("Image", MockImage);

    const { result } = renderHook(() =>
      useValidatedHeroBackdrop({
        heroImage: { path: "/backdrop.jpg", kind: "backdrop" },
        heroImageSrc: "https://image.tmdb.org/t/p/original/backdrop.jpg",
        preferPosterWhenNoBackdrop: true,
      }),
    );

    expect(result.current.usePosterHero).toBe(false);
    expect(result.current.showBackdropImage).toBe(true);

    await waitFor(() => {
      expect(result.current.isValidating).toBe(false);
    });
  });

  it("accepts widescreen backdrops for anime routes", async () => {
    vi.stubGlobal("Image", MockImage);

    const { result } = renderHook(() =>
      useValidatedHeroBackdrop({
        heroImage: { path: "/backdrop.jpg", kind: "backdrop" },
        heroImageSrc: "https://image.tmdb.org/t/p/original/backdrop.jpg",
        preferPosterWhenNoBackdrop: true,
      }),
    );

    await waitFor(() => {
      expect(result.current.usePosterHero).toBe(false);
      expect(result.current.showBackdropImage).toBe(true);
    });
  });

  it("falls back to poster hero for portrait backdrops", async () => {
    vi.stubGlobal(
      "Image",
      class extends MockImage {
        naturalWidth = 800;
        naturalHeight = 1200;
      },
    );

    const { result } = renderHook(() =>
      useValidatedHeroBackdrop({
        heroImage: {
          path: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/1.jpg",
          kind: "backdrop",
        },
        heroImageSrc:
          "https://s4.anilist.co/file/anilistcdn/media/anime/banner/1.jpg",
        preferPosterWhenNoBackdrop: true,
      }),
    );

    await waitFor(() => {
      expect(result.current.usePosterHero).toBe(true);
      expect(result.current.showBackdropImage).toBe(false);
    });
  });
});
