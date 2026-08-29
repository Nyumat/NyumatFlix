import { describe, expect, it } from "vitest";

import {
  hasEnglishSubtitles,
  matchesAudioPreference,
  payloadMatchesPlaybackPreferences,
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

  it("requires explicit resolution height for hard quality prefs", () => {
    expect(
      payloadMatchesPlaybackPreferences(
        {
          qualities: [{ label: "1080p", url: "https://cdn.example/1080.m3u8" }],
          preferredAudioLang: "jpn",
        },
        DEFAULT_PLAYBACK_PREFERENCES,
      ),
    ).toBe(true);

    expect(
      payloadMatchesPlaybackPreferences(
        {
          qualities: [{ label: "720p", url: "https://cdn.example/720.m3u8" }],
          preferredAudioLang: "jpn",
        },
        DEFAULT_PLAYBACK_PREFERENCES,
      ),
    ).toBe(false);
  });

  it("favors higher max quality when target is 1080p", () => {
    const preferences = {
      ...DEFAULT_PLAYBACK_PREFERENCES,
      playbackQuality: "1080p" as const,
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

  it("favors closer-to-target quality when 720p is required", () => {
    const preferences = {
      ...DEFAULT_PLAYBACK_PREFERENCES,
      playbackQuality: "720p" as const,
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

  it("picks the closest quality rung to the hard resolution pref", () => {
    const options = [{ label: "1080p" }, { label: "720p" }, { label: "480p" }];

    expect(pickScrapeQualityIndexForPreference(options, "720p")).toBe(1);
    expect(pickScrapeQualityIndexForPreference(options, "1080p")).toBe(0);
  });

  it("prefers a title's native multi-audio HLS over a single-track stream", () => {
    const preferences = {
      ...DEFAULT_PLAYBACK_PREFERENCES,
      playbackAudio: "dub" as const,
    };

    const singleTrack = scoreAnimeScrapePayload(
      {
        streamKind: "hls",
        preferredAudioLang: "en",
        nativeAudioTrackCount: 1,
        qualities: [{ label: "1080p", url: "https://cdn.example/1080.m3u8" }],
      },
      preferences,
    );

    const multiAudio = scoreAnimeScrapePayload(
      {
        streamKind: "hls",
        preferredAudioLang: "en",
        nativeAudioTrackCount: 2,
        nativeSubtitleTrackCount: 1,
        qualities: [{ label: "720p", url: "https://cdn.example/720.m3u8" }],
      },
      preferences,
    );

    expect(multiAudio).toBeGreaterThan(singleTrack);
  });

  it("boosts separate sub and dub audio versions regardless of provider", () => {
    const preferences = DEFAULT_PLAYBACK_PREFERENCES;

    const withMenu = scoreAnimeScrapePayload(
      {
        streamKind: "mp4",
        audioVersions: [
          {
            lang: "ja",
            label: "Japanese (Sub)",
            url: "https://cdn.example/sub.mp4",
          },
          {
            lang: "en",
            label: "English (Dub)",
            url: "https://cdn.example/dub.mp4",
          },
        ],
      },
      preferences,
    );

    const withoutMenu = scoreAnimeScrapePayload(
      {
        streamKind: "hls",
        preferredAudioLang: "ja",
        nativeAudioTrackCount: 1,
      },
      preferences,
    );

    expect(withMenu).toBeGreaterThan(withoutMenu);
  });

  it("does not treat catalog-only subtitles as in-player track switching", () => {
    const withCatalogOnly = scoreAnimeScrapePayload(
      {
        streamKind: "hls",
        nativeAudioTrackCount: 1,
        subtitles: [
          {
            lang: "English",
            url: "https://sub.1x2.space/en.vtt",
            format: "vtt",
          },
        ],
      },
      DEFAULT_PLAYBACK_PREFERENCES,
    );

    const withNativeSubs = scoreAnimeScrapePayload(
      {
        streamKind: "hls",
        nativeAudioTrackCount: 1,
        nativeSubtitleTrackCount: 2,
      },
      DEFAULT_PLAYBACK_PREFERENCES,
    );

    expect(withNativeSubs).toBeGreaterThan(withCatalogOnly);
  });
});
