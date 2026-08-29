import { describe, expect, it } from "vitest";

import {
  isCatalogSubtitle,
  isVttSubtitle,
  mergeHarvestedSubtitles,
  mergePayloadSubtitles,
  stampDonorSubtitles,
} from "@/lib/scrape/subtitle-harvest";
import type { ScrapeSubtitle } from "@/lib/scrape/types";

describe("subtitle harvest", () => {
  it("stamps donor referer and source onto native tracks", () => {
    const stamped = stampDonorSubtitles(
      [
        {
          lang: "English",
          url: "https://anikuro.example/en.vtt",
          format: "vtt",
        },
      ],
      { referer: "https://anikuro.example/", source: "AniKuro" },
    );

    expect(stamped).toEqual([
      {
        lang: "English",
        url: "https://anikuro.example/en.vtt",
        format: "vtt",
        referer: "https://anikuro.example/",
        source: "AniKuro",
      },
    ]);
  });

  it("leaves catalog softsubs unstamped", () => {
    const catalog = {
      lang: "English",
      url: "https://sub.1x2.space/subs/en.vtt",
      format: "vtt" as const,
    };

    expect(isCatalogSubtitle(catalog)).toBe(true);
    expect(
      stampDonorSubtitles([catalog], {
        referer: "https://www.animeonsen.xyz",
        source: "AnimeOnsen",
      }),
    ).toEqual([catalog]);
  });

  it("keeps existing tracks and appends vtt donors before ass", () => {
    const merged = mergeHarvestedSubtitles(
      [{ lang: "English", url: "https://cdn/native.vtt", format: "vtt" }],
      [
        {
          lang: "en-US",
          url: "https://api.animeonsen.xyz/v4/subtitles/title/en-US/1",
          format: "ass",
          referer: "https://www.animeonsen.xyz",
          source: "AnimeOnsen",
        },
        {
          lang: "English",
          url: "https://anikuro.example/en.vtt",
          format: "vtt",
          source: "AniKuro",
        },
      ],
    );

    expect(merged.map((track) => track.source ?? "native")).toEqual([
      "native",
      "AniKuro",
      "AnimeOnsen",
    ]);
    expect(isVttSubtitle(merged[1]!)).toBe(true);
  });

  it("dedupes harvested urls and grafts them onto qualities", () => {
    const native: ScrapeSubtitle = {
      lang: "English",
      url: "https://cdn/native.vtt",
      format: "vtt",
    };
    const harvested: ScrapeSubtitle = {
      lang: "English",
      url: "https://anikuro.example/en.vtt",
      format: "vtt",
      source: "AniKuro",
    };
    const payload = mergePayloadSubtitles(
      {
        subtitles: [native],
        qualities: [
          {
            label: "1080p",
            url: "https://cdn/1080.m3u8",
            subtitles: [native],
          },
        ],
      },
      [native, harvested],
    );

    expect(payload.subtitles).toHaveLength(2);
    expect(payload.qualities?.[0]?.subtitles).toHaveLength(2);
    expect(payload.qualities?.[0]?.subtitles?.[1]?.source).toBe("AniKuro");
  });
});
