import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useLocalTvWatchCoords } from "@/hooks/use-local-tv-watch-coords";
import { notifyPlaybackProgressChanged } from "@/lib/playback/progress-change-events";
import * as tvWatchTarget from "@/lib/tv-watch-target";

vi.mock("@/lib/tv-watch-target", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tv-watch-target")>();
  return {
    ...actual,
    resolveLocalTvWatchCoords: vi.fn(),
  };
});

describe("useLocalTvWatchCoords", () => {
  beforeEach(() => {
    vi.mocked(tvWatchTarget.resolveLocalTvWatchCoords).mockReset();
  });

  it("re-reads coords when playback progress changes", async () => {
    vi.mocked(tvWatchTarget.resolveLocalTvWatchCoords)
      .mockReturnValueOnce(null)
      .mockReturnValueOnce({ seasonNumber: 1, episodeNumber: 3 });

    const { result } = renderHook(() => useLocalTvWatchCoords(123));

    await waitFor(() => {
      expect(tvWatchTarget.resolveLocalTvWatchCoords).toHaveBeenCalledWith(123);
    });
    expect(result.current).toBeNull();

    act(() => {
      notifyPlaybackProgressChanged();
    });

    await waitFor(() => {
      expect(result.current).toEqual({ seasonNumber: 1, episodeNumber: 3 });
    });
    expect(tvWatchTarget.resolveLocalTvWatchCoords).toHaveBeenCalledTimes(2);
  });
});
