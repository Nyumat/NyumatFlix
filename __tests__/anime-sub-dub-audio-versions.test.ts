import { describe, expect, it } from "vitest";

import { shouldShowScrapeAudioVariantMenu } from "@/components/media/controls/scrape-audio-variant-menu";
import {
  buildSubDubAudioVersions,
  defaultAudioLangForTranslation,
} from "@/lib/scrape/anime/audio-versions";
import { resolveScrapeAudioVariantUrl } from "@/lib/scrape/audio-versions";

describe("buildSubDubAudioVersions", () => {
  it("builds a two-entry menu when both translations resolved", () => {
    const versions = buildSubDubAudioVersions({
      sub: {
        url: "https://cdn.example/sub.m3u8",
        subtitles: [
          { lang: "English", url: "https://cdn.example/en.vtt", format: "vtt" },
        ],
      },
      dub: { url: "https://cdn.example/dub.m3u8" },
    });

    expect(versions).toEqual([
      {
        lang: "ja",
        label: "Japanese (Sub)",
        url: "https://cdn.example/sub.m3u8",
        original: true,
        subtitles: [
          { lang: "English", url: "https://cdn.example/en.vtt", format: "vtt" },
        ],
      },
      {
        lang: "en",
        label: "English (Dub)",
        url: "https://cdn.example/dub.m3u8",
        subtitles: undefined,
      },
    ]);

    // The built pair must light up the player's Audio menu and resolve URLs.
    expect(shouldShowScrapeAudioVariantMenu(versions!, "ja")).toBe(true);
    expect(resolveScrapeAudioVariantUrl(versions!, "en", "off")).toBe(
      "https://cdn.example/dub.m3u8",
    );
    expect(resolveScrapeAudioVariantUrl(versions!, "ja", "off")).toBe(
      "https://cdn.example/sub.m3u8",
    );
  });

  it("returns undefined for one multi-audio manifest serving both translations", () => {
    // KAA masters carry both audio tracks at the same URL — the player's
    // native track menu owns that case.
    expect(
      buildSubDubAudioVersions({
        sub: { url: "https://cdn.example/master.m3u8" },
        dub: { url: "https://cdn.example/master.m3u8" },
      }),
    ).toBeUndefined();
  });

  it("returns undefined when the alternate translation is missing", () => {
    expect(
      buildSubDubAudioVersions({
        sub: { url: "https://cdn.example/sub.m3u8" },
        dub: null,
      }),
    ).toBeUndefined();
    expect(
      buildSubDubAudioVersions({
        sub: undefined,
        dub: { url: "https://cdn.example/dub.m3u8" },
      }),
    ).toBeUndefined();
  });
});

describe("defaultAudioLangForTranslation", () => {
  it("matches the requested translation", () => {
    expect(defaultAudioLangForTranslation("dub")).toBe("en");
    expect(defaultAudioLangForTranslation("sub")).toBe("ja");
    expect(defaultAudioLangForTranslation(undefined)).toBe("ja");
  });
});
