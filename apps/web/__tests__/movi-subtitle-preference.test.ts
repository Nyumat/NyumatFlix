import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  applyMoviSubtitlePreference,
  resolvePreferredSubtitleLang,
} from "@/lib/playback/movi-subtitle-preference";
import { TRACK_PREFERENCES_STORAGE_KEY } from "@/lib/playback/track-preferences-storage";
import type { MoviPlayerElement } from "@/lib/player/player-element";

const scopeKey = "movie:42";

describe("resolvePreferredSubtitleLang", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("uses saved subtitle preference when present", () => {
    window.localStorage.setItem(
      TRACK_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        [scopeKey]: {
          subtitleLang: "spanish",
          audioLang: null,
          updatedAt: 1,
        },
      }),
    );

    expect(
      resolvePreferredSubtitleLang(scopeKey, {
        preferEnglishSubtitles: true,
      }),
    ).toBe("spanish");
  });

  it("falls back to english when the setting is enabled", () => {
    expect(
      resolvePreferredSubtitleLang(scopeKey, {
        preferEnglishSubtitles: true,
      }),
    ).toBe("english");
  });

  it("prefers english subs for japanese audio preference", () => {
    expect(
      resolvePreferredSubtitleLang(scopeKey, {
        preferredAudioLang: "jpn",
      }),
    ).toBe("english");
  });
});

describe("applyMoviSubtitlePreference", () => {
  it("selects external scrape subtitles by stable id", async () => {
    const selectExternalSubtitle = vi.fn(async () => true);
    const selectSubtitleTrack = vi.fn(async () => true);

    const player = {
      getSubtitleLangs: () => [
        {
          id: "scrape-english-abc",
          lang: "English",
          label: "English · Provider",
          active: false,
        },
      ],
      getSubtitleTracks: () => [],
      selectExternalSubtitle,
      selectSubtitleTrack,
    } as unknown as MoviPlayerElement;

    await applyMoviSubtitlePreference(player, "english");

    expect(selectExternalSubtitle).toHaveBeenCalledWith("scrape-english-abc");
    expect(selectSubtitleTrack).not.toHaveBeenCalled();
  });

  it("selects muxed hls subtitles when no sidecars exist", async () => {
    const selectExternalSubtitle = vi.fn(async () => true);
    const selectSubtitleTrack = vi.fn(async () => true);

    const player = {
      getSubtitleLangs: () => [],
      getSubtitleTracks: () => [
        { id: 0, language: "eng", label: "English" },
        { id: 1, language: "jpn", label: "Japanese" },
      ],
      selectExternalSubtitle,
      selectSubtitleTrack,
    } as unknown as MoviPlayerElement;

    await applyMoviSubtitlePreference(player, "english");

    expect(selectExternalSubtitle).not.toHaveBeenCalled();
    expect(selectSubtitleTrack).toHaveBeenCalledWith(0);
  });

  it("turns subtitles off when preference is off", async () => {
    const selectExternalSubtitle = vi.fn(async () => true);
    const selectSubtitleTrack = vi.fn(async () => true);

    const player = {
      getSubtitleLangs: () => [
        {
          id: "scrape-english-abc",
          lang: "English",
          label: "English",
          active: true,
        },
      ],
      getSubtitleTracks: () => [{ id: 0, language: "eng", label: "English" }],
      selectExternalSubtitle,
      selectSubtitleTrack,
    } as unknown as MoviPlayerElement;

    await applyMoviSubtitlePreference(player, "off");

    expect(selectExternalSubtitle).toHaveBeenCalledWith(null);
    expect(selectSubtitleTrack).toHaveBeenCalledWith(null);
  });
});
