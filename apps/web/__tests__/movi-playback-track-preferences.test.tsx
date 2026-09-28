import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { useMoviPlaybackTrackPreferences } from "@/hooks/use-movi-playback-track-preferences";
import type { MoviPlayerElement } from "@/lib/player/player-element";
import {
  resetTrackPreferencesForTests,
  updateTrackPreferences,
} from "@/lib/playback/track-preferences-storage";

const scopeKey = "movie:99";
const progressKey = { mediaType: "movie" as const, contentId: 99 };

describe("useMoviPlaybackTrackPreferences", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetTrackPreferencesForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not re-apply subtitles when stored preference is off", async () => {
    updateTrackPreferences(scopeKey, { subtitleLang: "off", audioLang: null });

    const selectExternalSubtitle = vi.fn(async () => true);
    const selectSubtitleTrack = vi.fn(async () => true);

    const player = {
      getSubtitleLangs: () => [
        {
          id: "scrape-english-abc",
          lang: "English",
          label: "English",
          active: false,
        },
      ],
      getSubtitleTracks: () => [],
      selectExternalSubtitle,
      selectSubtitleTrack,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MoviPlayerElement;

    renderHook(() =>
      useMoviPlaybackTrackPreferences(player, progressKey, "source-1", {
        preferEnglishSubtitles: true,
      }),
    );

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(selectExternalSubtitle).not.toHaveBeenCalled();
    expect(selectSubtitleTrack).not.toHaveBeenCalled();
  });

  it("cancels pending apply retries after the user turns subtitles off", async () => {
    const selectExternalSubtitle = vi.fn(async () => true);
    const selectSubtitleTrack = vi.fn(async () => true);

    const player = {
      getSubtitleLangs: () => [
        {
          id: "scrape-english-abc",
          lang: "English",
          label: "English",
          active: false,
        },
      ],
      getSubtitleTracks: () => [],
      selectExternalSubtitle,
      selectSubtitleTrack,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      getActiveSubtitlePreference: () => "off",
    } as unknown as MoviPlayerElement;

    const listeners = new Map<string, EventListener>();
    player.addEventListener = vi.fn((type: string, handler: EventListener) => {
      listeners.set(type, handler);
    }) as typeof player.addEventListener;

    renderHook(() =>
      useMoviPlaybackTrackPreferences(player, progressKey, "source-1", {
        preferEnglishSubtitles: true,
      }),
    );

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    selectExternalSubtitle.mockClear();

    await act(async () => {
      listeners.get("subtitletrackchange")?.(new Event("subtitletrackchange"));
      vi.advanceTimersByTime(3000);
    });

    expect(selectExternalSubtitle).not.toHaveBeenCalled();
  });
});
