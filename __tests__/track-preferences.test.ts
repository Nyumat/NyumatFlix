import { describe, expect, it } from "vitest";

import {
  normalizeTrackLanguage,
  pickTrackIndexByLanguage,
  trackMatchesLanguage,
} from "@/lib/playback/track-matching";
import {
  getTrackPreferences,
  trackPreferenceStorageKey,
  TRACK_PREFERENCES_STORAGE_KEY,
  updateTrackPreferences,
  type TrackPreferencesMap,
} from "@/lib/playback/track-preferences-storage";

describe("track-matching", () => {
  it("matches common language aliases", () => {
    expect(trackMatchesLanguage({ lang: "Japanese" }, "ja")).toBe(true);
    expect(trackMatchesLanguage({ label: "English (US)" }, "english")).toBe(
      true,
    );
    expect(trackMatchesLanguage({ language: "spa" }, "spanish")).toBe(true);
    expect(trackMatchesLanguage({ lang: "French" }, "english")).toBe(false);
  });

  it("normalizes punctuation and casing", () => {
    expect(normalizeTrackLanguage("English (CC)")).toBe("englishcc");
    expect(normalizeTrackLanguage("  JA  ")).toBe("ja");
  });

  it("picks the first matching track index", () => {
    const tracks = [
      { lang: "Japanese" },
      { lang: "English" },
      { lang: "English (CC)" },
    ];

    expect(pickTrackIndexByLanguage(tracks, "english")).toBe(1);
    expect(pickTrackIndexByLanguage(tracks, "french")).toBeNull();
  });
});

describe("track-preferences-storage", () => {
  it("scopes preferences to the show, not the episode", () => {
    expect(
      trackPreferenceStorageKey({
        mediaType: "tv",
        contentId: 1399,
      }),
    ).toBe("tv:1399");

    expect(
      trackPreferenceStorageKey({
        mediaType: "tv",
        contentId: 1399,
        seasonNumber: 1,
        episodeNumber: 3,
      }),
    ).toBe("tv:1399");
  });

  it("persists subtitle and audio preferences", () => {
    const scopeKey = "tv:220542";
    updateTrackPreferences(scopeKey, {
      subtitleLang: "English",
      audioLang: "Japanese",
    });

    expect(getTrackPreferences(scopeKey)).toEqual({
      subtitleLang: "English",
      audioLang: "Japanese",
      updatedAt: expect.any(Number),
    });
  });

  it("merges partial updates", () => {
    const scopeKey = "movie:550";
    updateTrackPreferences(scopeKey, {
      subtitleLang: "Spanish",
      audioLang: "English",
    });
    updateTrackPreferences(scopeKey, {
      subtitleLang: "off",
    });

    expect(getTrackPreferences(scopeKey)).toEqual({
      subtitleLang: "off",
      audioLang: "English",
      updatedAt: expect.any(Number),
    });
  });

  it("stores entries in a shared localStorage map", () => {
    const raw = window.localStorage.getItem(TRACK_PREFERENCES_STORAGE_KEY);
    const map = raw ? (JSON.parse(raw) as TrackPreferencesMap) : {};
    expect(map["tv:220542"]?.audioLang).toBe("Japanese");
  });
});
