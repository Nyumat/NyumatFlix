import { describe, expect, it } from "vitest";

import {
  hasEnglishSubtitles,
  matchesAudioPreference,
  payloadHasDubAudio,
  payloadMatchesAnimeEarlyWin,
  payloadMatchesPlaybackPreferences,
  pickScrapeQualityIndexForPreference,
  scoreAnimePlaybackRacePayload,
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

  it("does not require target resolution for early playback prefs", () => {
    expect(
      payloadMatchesPlaybackPreferences(
        {
          qualities: [{ label: "1080p", url: "https://cdn.example/1080.m3u8" }],
          preferredAudioLang: "jpn",
          subtitles: [{ lang: "English", url: "https://cdn.example/en.vtt" }],
        },
        DEFAULT_PLAYBACK_PREFERENCES,
      ),
    ).toBe(true);

    expect(
      payloadMatchesPlaybackPreferences(
        {
          qualities: [{ label: "720p", url: "https://cdn.example/720.m3u8" }],
          preferredAudioLang: "jpn",
          subtitles: [{ lang: "English", url: "https://cdn.example/en.vtt" }],
        },
        DEFAULT_PLAYBACK_PREFERENCES,
      ),
    ).toBe(true);
  });

  it("requires english subs for early playback when that pref is enabled", () => {
    expect(
      payloadMatchesPlaybackPreferences(
        {
          qualities: [{ label: "1080p", url: "https://cdn.example/1080.m3u8" }],
          preferredAudioLang: "jpn",
        },
        DEFAULT_PLAYBACK_PREFERENCES,
      ),
    ).toBe(false);
  });

  it("favors english subtitles over a higher-resolution stream without subs", () => {
    const preferences = {
      ...DEFAULT_PLAYBACK_PREFERENCES,
      playbackQuality: "1080p" as const,
    };

    const withSubs720 = scoreAnimeScrapePayload(
      {
        qualities: [{ label: "720p", url: "https://cdn.example/720.m3u8" }],
        subtitles: [{ lang: "English", url: "https://cdn.example/en.vtt" }],
        preferredAudioLang: "jpn",
      },
      preferences,
    );

    const withoutSubs1080 = scoreAnimeScrapePayload(
      {
        qualities: [{ label: "1080p", url: "https://cdn.example/1080.m3u8" }],
        preferredAudioLang: "jpn",
      },
      preferences,
    );

    expect(withSubs720).toBeGreaterThan(withoutSubs1080);
  });

  it("still favors higher max quality when subtitle coverage is equal", () => {
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

  it("does not early-win justanime english megaplay over switchable dub siblings", () => {
    expect(
      payloadMatchesAnimeEarlyWin({
        providerId: "justanime",
        preferredAudioLang: "eng",
        nativeAudioTrackCount: 1,
      }),
    ).toBe(false);
    expect(
      payloadMatchesAnimeEarlyWin({
        providerId: "kickassanime",
        preferredAudioLang: "jpn",
        nativeAudioTrackCount: 2,
      }),
    ).toBe(true);
    expect(
      payloadMatchesAnimeEarlyWin({
        providerId: "kyren",
        preferredAudioLang: "eng",
        nativeAudioTrackCount: 1,
      }),
    ).toBe(false);
  });

  it("scores kickass multi-audio above justanime megaplay dub", () => {
    const preferences = {
      ...DEFAULT_PLAYBACK_PREFERENCES,
      playbackAudio: "dub" as const,
    };
    const justanime = scoreAnimePlaybackRacePayload(
      {
        providerId: "justanime",
        streamKind: "hls",
        preferredAudioLang: "eng",
        nativeAudioTrackCount: 1,
        qualities: [{ label: "1080p", url: "https://cdn.example/1080.m3u8" }],
      },
      preferences,
    );
    const kickass = scoreAnimePlaybackRacePayload(
      {
        providerId: "kickassanime",
        streamKind: "hls",
        preferredAudioLang: "jpn",
        nativeAudioTrackCount: 2,
        qualities: [{ label: "1080p", url: "https://cdn.example/1080.m3u8" }],
      },
      preferences,
    );

    expect(kickass).toBeGreaterThan(justanime);
  });

  it("treats english audio and multi-audio HLS as having dub", () => {
    expect(
      payloadHasDubAudio({
        preferredAudioLang: "eng",
        nativeAudioTrackCount: 1,
      }),
    ).toBe(true);
    expect(
      payloadHasDubAudio({
        nativeAudioTrackCount: 2,
        streamKind: "hls",
      }),
    ).toBe(true);
    expect(
      payloadHasDubAudio({
        audioVersions: [
          { lang: "ja", label: "Japanese", url: "https://cdn.example/ja.mp4" },
          { lang: "en", label: "English", url: "https://cdn.example/en.mp4" },
        ],
      }),
    ).toBe(true);
    expect(
      payloadHasDubAudio({
        preferredAudioLang: "jpn",
        nativeAudioTrackCount: 1,
      }),
    ).toBe(false);
  });

  it("scores a dub-capable source above a japanese-only sibling during best-match", () => {
    const japaneseOnly = scoreAnimeScrapePayload(
      {
        streamKind: "hls",
        preferredAudioLang: "jpn",
        nativeAudioTrackCount: 1,
        qualities: [{ label: "1080p", url: "https://cdn.example/1080.m3u8" }],
        subtitles: [{ lang: "English", url: "https://cdn.example/en.vtt" }],
      },
      DEFAULT_PLAYBACK_PREFERENCES,
    );

    const withDub = scoreAnimeScrapePayload(
      {
        streamKind: "hls",
        preferredAudioLang: "jpn",
        nativeAudioTrackCount: 2,
        qualities: [{ label: "720p", url: "https://cdn.example/720.m3u8" }],
      },
      DEFAULT_PLAYBACK_PREFERENCES,
    );

    expect(withDub).toBeGreaterThan(japaneseOnly);
  });
});
