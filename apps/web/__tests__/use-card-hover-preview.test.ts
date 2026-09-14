import { describe, expect, it, vi } from "vitest";

import { renderHook, act } from "@testing-library/react";
import { useCardHoverPreview } from "@/hooks/use-card-hover-preview";

vi.mock("@/hooks/useMedia", () => ({
  default: () => false,
}));

vi.mock("@/lib/stores/app-settings-store", () => ({
  useAppSettingsStore: (
    selector: (state: { disableHeroTrailers: boolean }) => unknown,
  ) => selector({ disableHeroTrailers: false }),
}));

vi.mock("@/hooks/use-videasy-trailer-stream", () => ({
  useVideasyTrailerStream: () => ({
    mp4Url: null,
    hlsUrl: null,
    status: "idle",
    handleStreamError: () => {
      /* mock */
    },
  }),
}));

describe("useCardHoverPreview eligibility", () => {
  it("does not arm preview in poster catalog mode", () => {
    const { result } = renderHook(() =>
      useCardHoverPreview({
        previewId: "movie-1",
        imdbId: "tt0111161",
        catalogCardStyle: "poster",
      }),
    );

    act(() => {
      result.current.onPointerEnter();
    });

    expect(result.current.isPreviewActive).toBe(false);
  });
});
