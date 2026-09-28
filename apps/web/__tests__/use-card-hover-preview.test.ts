import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderHook, act } from "@testing-library/react";
import { useCardHoverPreview } from "@/hooks/use-card-hover-preview";
import { resetUserInteractionForTests } from "@/lib/media/autoplay-unlock";

const stream = vi.hoisted(() => ({
  value: {
    mp4Url: null as string | null,
    hlsUrl: null as string | null,
    status: "idle" as "idle" | "loading" | "ready" | "error",
    handleStreamError: () => {
      /* mock */
    },
  },
}));

vi.mock("@/hooks/useMedia", () => ({
  default: () => false,
}));

vi.mock("@/lib/stores/app-settings-store", () => ({
  useAppSettingsStore: (
    selector: (state: { disableHeroTrailers: boolean }) => unknown,
  ) => selector({ disableHeroTrailers: false }),
}));

vi.mock("@/hooks/use-videasy-trailer-stream", () => ({
  useVideasyTrailerStream: () => stream.value,
}));

const resetStream = () => {
  stream.value = {
    mp4Url: null,
    hlsUrl: null,
    status: "idle",
    handleStreamError: () => {
      /* mock */
    },
  };
};

describe("useCardHoverPreview eligibility", () => {
  it("does not arm preview in poster catalog mode", () => {
    resetStream();
    const { result } = renderHook(() =>
      useCardHoverPreview({
        previewId: "movie-1",
        previewSource: { kind: "stream", imdbId: "tt0111161" },
        catalogCardStyle: "poster",
      }),
    );

    act(() => {
      result.current.onPointerEnter();
    });

    expect(result.current.isPreviewActive).toBe(false);
    expect(result.current.isPreviewEligible).toBe(false);
  });

  it("does not arm preview without a preview source", () => {
    resetStream();
    const { result } = renderHook(() =>
      useCardHoverPreview({
        previewId: "movie-1",
        previewSource: undefined,
        catalogCardStyle: "backdrop",
      }),
    );

    act(() => {
      result.current.onPointerEnter();
    });

    expect(result.current.isPreviewActive).toBe(false);
  });

  it("does not arm preview for an unresolved AniList fallback id", () => {
    // readCardPreviewSource only emits a tmdbId when the id is a real TMDB id;
    // an AniList fallback that also lacks a youtube key has no source at all.
    resetStream();
    const { result } = renderHook(() =>
      useCardHoverPreview({
        previewId: "tv-1",
        previewSource: undefined,
        catalogCardStyle: "backdrop",
      }),
    );

    act(() => {
      result.current.onPointerEnter();
    });

    expect(result.current.isPreviewActive).toBe(false);
  });

  it("arms preview for a YouTube-only source on pointer enter", () => {
    resetStream();
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useCardHoverPreview({
        previewId: "tv-1",
        previewSource: { kind: "youtube", youtubeKey: "abc123" },
        catalogCardStyle: "backdrop",
      }),
    );

    act(() => {
      result.current.onPointerEnter();
    });
    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(result.current.isPreviewActive).toBe(true);
    vi.useRealTimers();
  });
});

describe("useCardHoverPreview trailer availability", () => {
  it("reports availability only once a stream is ready", () => {
    resetStream();
    const { result, rerender } = renderHook(() =>
      useCardHoverPreview({
        previewId: "movie-2",
        previewSource: { kind: "stream", imdbId: "tt0111161" },
        catalogCardStyle: "backdrop",
      }),
    );

    expect(result.current.isTrailerAvailable).toBe(false);

    stream.value = {
      mp4Url: "https://cdn.example/trailer.mp4",
      hlsUrl: null,
      status: "ready",
      handleStreamError: () => {
        /* mock */
      },
    };
    rerender();

    expect(result.current.isTrailerAvailable).toBe(true);
  });

  it("reports availability for a YouTube source without loading a stream", () => {
    resetStream();
    const { result } = renderHook(() =>
      useCardHoverPreview({
        previewId: "tv-2",
        previewSource: { kind: "youtube", youtubeKey: "abc123" },
        catalogCardStyle: "backdrop",
      }),
    );

    expect(result.current.isTrailerAvailable).toBe(true);
  });
});

describe("useCardHoverPreview auto-unmute", () => {
  beforeEach(() => {
    resetUserInteractionForTests();
  });

  it("stays muted when the page has not been interacted with", () => {
    resetStream();
    const { result } = renderHook(() =>
      useCardHoverPreview({
        previewId: "movie-muted",
        previewSource: { kind: "stream", imdbId: "tt0000001" },
        catalogCardStyle: "backdrop",
      }),
    );

    vi.useFakeTimers();
    act(() => {
      result.current.onPointerEnter();
    });
    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(result.current.isUnmuted).toBe(false);
    vi.useRealTimers();
  });

  it("auto-unmutes on hover once the user has interacted", () => {
    resetStream();
    const { result } = renderHook(() =>
      useCardHoverPreview({
        previewId: "movie-unmuted",
        previewSource: { kind: "stream", imdbId: "tt0000002" },
        catalogCardStyle: "backdrop",
      }),
    );

    act(() => {
      window.dispatchEvent(new Event("pointerdown"));
    });

    vi.useFakeTimers();
    act(() => {
      result.current.onPointerEnter();
    });
    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(result.current.isUnmuted).toBe(true);
    vi.useRealTimers();
  });
});
