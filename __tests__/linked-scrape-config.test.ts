import { describe, expect, it } from "vitest";

import {
  attachSubtitlesToQualities,
  dedupeSubtitles,
  resolveActiveSubtitles,
} from "@/lib/scrape/linked-config";
import {
  buildScrapeQualityPlayOptions,
  isAbrOnlyQualityFailover,
} from "@/lib/scrape/player-sources";
import {
  mapVidKingSubtitles,
  selectVidKingSources,
} from "@/lib/scrape/providers/vidking";

describe("linked scrape config", () => {
  it("prefers audio-version softsubs over quality and top-level", () => {
    expect(
      resolveActiveSubtitles({
        topLevel: [{ lang: "en", url: "https://cdn/top.vtt" }],
        qualities: [
          {
            label: "720p",
            url: "https://cdn/720.m3u8",
            subtitles: [{ lang: "es", url: "https://cdn/es.vtt" }],
          },
        ],
        qualityIndex: 0,
        audioVersions: [
          {
            lang: "ja-JP",
            label: "Japanese",
            url: "https://cdn/ja.m3u8",
            subtitles: [{ lang: "en", url: "https://cdn/ja-en.vtt" }],
          },
        ],
        audioLang: "ja-JP",
      }),
    ).toEqual([{ lang: "en", url: "https://cdn/ja-en.vtt" }]);
  });

  it("switches caption sets with the selected quality", () => {
    const qualities = [
      {
        label: "720p",
        url: "https://cdn/720.m3u8",
        subtitles: [{ lang: "jp", url: "https://cdn/jp.vtt" }],
      },
      {
        label: "1080p",
        url: "https://cdn/1080.m3u8",
        subtitles: [
          { lang: "en", url: "https://cdn/en.vtt" },
          { lang: "es", url: "https://cdn/es.vtt" },
          { lang: "fr", url: "https://cdn/fr.vtt" },
        ],
      },
    ];

    expect(
      resolveActiveSubtitles({
        qualities,
        qualityIndex: 0,
        topLevel: [{ lang: "fallback", url: "https://cdn/fallback.vtt" }],
      }),
    ).toEqual([{ lang: "jp", url: "https://cdn/jp.vtt" }]);

    expect(
      resolveActiveSubtitles({
        qualities,
        qualityIndex: 1,
      }),
    ).toEqual([
      { lang: "en", url: "https://cdn/en.vtt" },
      { lang: "es", url: "https://cdn/es.vtt" },
      { lang: "fr", url: "https://cdn/fr.vtt" },
    ]);
  });

  it("attaches shared subs onto qualities that lack their own", () => {
    expect(
      attachSubtitlesToQualities(
        [
          { label: "720p", url: "https://cdn/720.m3u8" },
          {
            label: "1080p",
            url: "https://cdn/1080.m3u8",
            subtitles: [{ lang: "en", url: "https://cdn/own.vtt" }],
          },
        ],
        [{ lang: "shared", url: "https://cdn/shared.vtt" }],
      ),
    ).toEqual([
      {
        label: "720p",
        url: "https://cdn/720.m3u8",
        subtitles: [{ lang: "shared", url: "https://cdn/shared.vtt" }],
      },
      {
        label: "1080p",
        url: "https://cdn/1080.m3u8",
        subtitles: [{ lang: "en", url: "https://cdn/own.vtt" }],
      },
    ]);
  });

  it("builds play options that carry per-quality subtitle sets", () => {
    const options = buildScrapeQualityPlayOptions(
      "https://cdn/1080.m3u8",
      [
        {
          label: "720p",
          url: "https://cdn/720.m3u8",
          subtitles: [{ lang: "jp", url: "https://cdn/jp.vtt" }],
        },
        {
          label: "1080p",
          url: "https://cdn/1080.m3u8",
          subtitles: [
            { lang: "en", url: "https://cdn/en.vtt" },
            { lang: "es", url: "https://cdn/es.vtt" },
          ],
        },
      ],
      "https://referer.example/",
    );

    expect(options[0]?.subtitles).toHaveLength(2);
    expect(
      options.find((option) => option.label === "720p")?.subtitles,
    ).toEqual([{ lang: "jp", url: "https://cdn/jp.vtt" }]);
  });

  it("detects ABR height ladders that should not remount on fatal errors", () => {
    expect(
      isAbrOnlyQualityFailover([
        { label: "Auto" },
        { label: "800p" },
        { label: "534p" },
        { label: "266p" },
      ]),
    ).toBe(true);

    expect(
      isAbrOnlyQualityFailover([
        { label: "Auto" },
        { label: "ophim · 1080p" },
        { label: "ophim · 720p" },
      ]),
    ).toBe(true);

    expect(
      isAbrOnlyQualityFailover([
        { label: "Auto" },
        { label: "ophim" },
        { label: "videasy" },
      ]),
    ).toBe(false);

    expect(isAbrOnlyQualityFailover([{ label: "Auto" }])).toBe(false);
  });

  it("dedupes identical subtitle urls", () => {
    expect(
      dedupeSubtitles([
        { lang: "en", url: "https://cdn/en.vtt" },
        { lang: "en", url: "https://cdn/en.vtt" },
        { lang: "es", url: "https://cdn/es.vtt" },
      ]),
    ).toEqual([
      { lang: "en", url: "https://cdn/en.vtt" },
      { lang: "es", url: "https://cdn/es.vtt" },
    ]);
  });
});

describe("vidking linked sources", () => {
  it("keeps adaptive master as Auto and exposes variant ladder", () => {
    const selected = selectVidKingSources([
      {
        quality: "Auto",
        url: "https://cdn.example/r2/cdn2/tok/playlist.m3u8",
      },
      {
        quality: "1080p",
        url: "https://cdn.example/r2/cdn2/tok/1080p/index.m3u8",
      },
      {
        quality: "720p",
        url: "https://cdn.example/r2/cdn2/tok/720p/index.m3u8",
      },
    ]);

    expect(selected?.streamUrl).toContain("/playlist.m3u8");
    expect(selected?.qualities.map((q) => q.label)).toEqual(["1080p", "720p"]);
  });

  it("treats Oxygen-style master.m3u8 as the adaptive master", () => {
    const selected = selectVidKingSources([
      {
        quality: "auto",
        url: "https://moon.ironwallnet.net/nodash/x/y.mp4/master.m3u8?key=abc",
      },
      {
        quality: "auto",
        type: "dash",
        url: "https://moon.ironwallnet.net/dash/x/y.mpd?key=abc",
      },
    ]);

    expect(selected?.streamUrl).toContain("/master.m3u8");
    expect(selected?.qualities).toEqual([]);
  });

  it("collapses duplicated VidKing subtitle langs", () => {
    expect(
      mapVidKingSubtitles([
        { label: "English", url: "https://cdn/en.vtt" },
        { label: "English", url: "https://cdn/en-dup.vtt" },
        { label: "Spanish", url: "https://cdn/es.vtt" },
        { label: "Spanish", url: "https://cdn/es-dup.vtt" },
      ]),
    ).toEqual([
      { lang: "English", url: "https://cdn/en.vtt" },
      { lang: "Spanish", url: "https://cdn/es.vtt" },
    ]);
  });
});
