import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useMovieWatchButtonLabel } from "@/hooks/use-movie-watch-button-label";
import { notifyPlaybackProgressChanged } from "@/lib/playback/progress-change-events";
import * as movieWatchLabel from "@/lib/playback/movie-watch-label";

vi.mock("@/lib/playback/movie-watch-label", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/playback/movie-watch-label")>();
  return {
    ...actual,
    movieWatchButtonLabel: vi.fn(),
  };
});

describe("useMovieWatchButtonLabel", () => {
  beforeEach(() => {
    vi.mocked(movieWatchLabel.movieWatchButtonLabel).mockReset();
  });

  it("re-reads the label when playback progress changes", async () => {
    vi.mocked(movieWatchLabel.movieWatchButtonLabel)
      .mockReturnValueOnce("Play")
      .mockReturnValueOnce("Resume");

    const { result } = renderHook(() =>
      useMovieWatchButtonLabel(424_242, "movie"),
    );

    await waitFor(() => {
      expect(movieWatchLabel.movieWatchButtonLabel).toHaveBeenCalledWith(
        424_242,
      );
    });
    expect(result.current).toBe("Play");

    act(() => {
      notifyPlaybackProgressChanged();
    });

    await waitFor(() => {
      expect(result.current).toBe("Resume");
    });
    expect(movieWatchLabel.movieWatchButtonLabel).toHaveBeenCalledTimes(2);
  });

  it("returns Play for non-movie media types", () => {
    const { result } = renderHook(() =>
      useMovieWatchButtonLabel(424_242, "tv"),
    );

    expect(result.current).toBe("Play");
    expect(movieWatchLabel.movieWatchButtonLabel).not.toHaveBeenCalled();
  });
});
