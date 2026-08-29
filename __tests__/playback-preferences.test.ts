import { describe, expect, it } from "vitest";

import {
  hasEnglishSubtitles,
  matchesAudioPreference,
  pickScrapeQualityIndexForPreference,
  scoreAnimeScrapePayload,
  DEFAULT_PLAYBACK_PREFERENCES,
} from "@/lib/playback/playback-preferences";

describe("playback preferences", () => {
  it("does not treat missing audio language as matching dub or sub", () => {
    expect(matchesAudioPreference(undefined, "dub")).toBe(false);
    expect(matchesAudioPreference("", "dub")).toBe(false);
    expect(matchesAudioPreference(undefined, "sub")).toBe(false);
    expect(matchesAudioPreference("eng", "dub")).toBe(true);
    expect(matchesAudioPreference("jpn", "sub")).toBe(true);
  });

  it("favors higher max quality when best available is selected", () => {
    const preferences = {
      ...DEFAULT_PLAYBACK_PREFERENCES,
      playbackQuality: "best" as const,
    };

    const high = scoreAnimeScrapePayload(
      {
        qualities: [
          { label: "1080p", url: "https://cdn.example/1080.m3u8" },
          { label: "720p", url: "https://cdn.example/720.m3u8" },
        ],
        subtitles: [{ lang: "English", url: "https://cdn.example/en.vtt" }],
        preferredAudioLang: "jpn",
      },
      preferences,
    );

    const low = scoreAnimeScrapePayload(
      {
        qualities: [{ label: "480p", url: "https://cdn.example/480.mp4" }],
        subtitles: [{ lang: "English", url: "https://cdn.example/en.vtt" }],
        preferredAudioLang: "jpn",
      },
      preferences,
    );

    expect(high).toBeGreaterThan(low);
  });

  it("favors lower max quality when save data is selected", () => {
    const preferences = {
      ...DEFAULT_PLAYBACK_PREFERENCES,
      playbackQuality: "save-data" as const,
    };

    const high = scoreAnimeScrapePayload(
      {
        qualities: [
          { label: "1080p", url: "https://cdn.example/1080.m3u8" },
          { label: "720p", url: "https://cdn.example/720.m3u8" },
        ],
        subtitles: [{ lang: "English", url: "https://cdn.example/en.vtt" }],
        preferredAudioLang: "jpn",
      },
      preferences,
    );

    const low = scoreAnimeScrapePayload(
      {
        qualities: [{ label: "480p", url: "https://cdn.example/480.mp4" }],
        subtitles: [{ lang: "English", url: "https://cdn.example/en.vtt" }],
        preferredAudioLang: "jpn",
      },
      preferences,
    );

    expect(low).toBeGreaterThan(high);
  });

  it("detects english subtitles", () => {
    expect(
      hasEnglishSubtitles([
        { lang: "French", url: "https://cdn.example/fr.vtt" },
        { lang: "English", url: "https://cdn.example/en.vtt" },
      ]),
    ).toBe(true);
    expect(
      hasEnglishSubtitles([
        { lang: "French", url: "https://cdn.example/fr.vtt" },
      ]),
    ).toBe(false);
  });

  it("picks the lowest quality rung in save-data mode", () => {
    const options = [{ label: "1080p" }, { label: "720p" }, { label: "480p" }];

    expect(pickScrapeQualityIndexForPreference(options, "save-data")).toBe(2);
    expect(pickScrapeQualityIndexForPreference(options, "best")).toBe(0);
  });
});
