import { describe, expect, it } from "vitest";

import { shouldShowScrapeAudioVariantMenu } from "@/components/media/controls/scrape-audio-variant-menu";
import type { ScrapeAudioVersion } from "@/lib/scrape/types";

const englishJapaneseVersions: ScrapeAudioVersion[] = [
  {
    lang: "en",
    label: "English",
    url: "https://cdn.example/en.m3u8",
  },
  {
    lang: "ja",
    label: "Japanese",
    url: "https://cdn.example/ja.m3u8",
    original: true,
  },
];

describe("shouldShowScrapeAudioVariantMenu", () => {
  it("shows when multiple provider audio versions exist", () => {
    expect(
      shouldShowScrapeAudioVariantMenu(englishJapaneseVersions, "en"),
    ).toBe(true);
  });

  it("shows hardsubs controls for a single version with hardsub tracks", () => {
    const versions: ScrapeAudioVersion[] = [
      {
        lang: "ja",
        label: "Japanese",
        url: "https://cdn.example/ja.m3u8",
        hardSubs: [
          {
            lang: "en",
            label: "English",
            url: "https://cdn.example/en-hs.m3u8",
          },
        ],
      },
    ];

    expect(shouldShowScrapeAudioVariantMenu(versions, "ja")).toBe(true);
  });

  it("hides when there is only one clean audio version", () => {
    const versions: ScrapeAudioVersion[] = [
      {
        lang: "en",
        label: "English",
        url: "https://cdn.example/en.m3u8",
      },
    ];

    expect(shouldShowScrapeAudioVariantMenu(versions, "en")).toBe(false);
  });
});
