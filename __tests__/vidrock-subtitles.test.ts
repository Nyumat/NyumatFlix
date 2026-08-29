import { describe, expect, it, vi } from "vitest";

import {
  buildVdrkCatalogSubtitleApiUrl,
  fetchScrapeFallbackSubtitles,
  fetchVdrkCatalogSubtitles,
  parseVdrkCatalogSubtitleEntries,
  VDRK_CATALOG_SUBTITLE_ORIGIN,
} from "@/lib/scrape/subtitles";

vi.mock("@/lib/scrape/fetch", () => ({
  scrapeFetchText: vi.fn(),
}));

import { scrapeFetchText } from "@/lib/scrape/fetch";

describe("vdrk catalog subtitles", () => {
  it("builds movie and tv API URLs", () => {
    expect(
      buildVdrkCatalogSubtitleApiUrl({ mediaType: "movie", tmdbId: 1363979 }),
    ).toBe(`${VDRK_CATALOG_SUBTITLE_ORIGIN}/v1/movie/1363979`);

    expect(
      buildVdrkCatalogSubtitleApiUrl({
        mediaType: "tv",
        tmdbId: 1399,
        seasonNumber: 2,
        episodeNumber: 3,
      }),
    ).toBe(`${VDRK_CATALOG_SUBTITLE_ORIGIN}/v1/tv/1399/2/3`);
  });

  it("defaults tv season and episode to 1", () => {
    expect(
      buildVdrkCatalogSubtitleApiUrl({ mediaType: "tv", tmdbId: 1399 }),
    ).toBe(`${VDRK_CATALOG_SUBTITLE_ORIGIN}/v1/tv/1399/1/1`);
  });

  it("parses catalog subtitle arrays", () => {
    const subtitles = parseVdrkCatalogSubtitleEntries([
      {
        label: "English",
        file: "https://cache.vdrk.site/v1/vtt/movie/1363979/English.vtt",
      },
      {
        label: "English 2",
        file: "https://cache.vdrk.site/v1/vtt/movie/1363979/English 2.vtt",
      },
    ]);

    expect(subtitles).toEqual([
      {
        lang: "English",
        url: "https://cache.vdrk.site/v1/vtt/movie/1363979/English.vtt",
        format: "vtt",
        referer: "https://vidrock.net/",
      },
      {
        lang: "English 2",
        url: "https://cache.vdrk.site/v1/vtt/movie/1363979/English 2.vtt",
        format: "vtt",
        referer: "https://vidrock.net/",
      },
    ]);
  });

  it("returns empty arrays for invalid payloads", () => {
    expect(parseVdrkCatalogSubtitleEntries(null)).toEqual([]);
    expect(parseVdrkCatalogSubtitleEntries({})).toEqual([]);
    expect(parseVdrkCatalogSubtitleEntries([{ label: "English" }])).toEqual([]);
  });

  it("fetches subtitles from the catalog API", async () => {
    (scrapeFetchText as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      status: 200,
      text: JSON.stringify([
        {
          label: "English",
          file: "https://cache.vdrk.site/v1/vtt/movie/1363979/English.vtt",
        },
      ]),
    });

    const subtitles = await fetchVdrkCatalogSubtitles({
      mediaType: "movie",
      tmdbId: 1363979,
    });

    expect(scrapeFetchText).toHaveBeenCalledWith(
      `${VDRK_CATALOG_SUBTITLE_ORIGIN}/v1/movie/1363979`,
      expect.objectContaining({
        Referer: "https://vidrock.net/",
        Origin: "https://vidrock.net",
      }),
      expect.any(Object),
    );
    expect(subtitles).toHaveLength(1);
    expect(subtitles[0]?.lang).toBe("English");
  });

  it("falls back from sub1x2 to the vdrk catalog", async () => {
    (scrapeFetchText as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        status: 200,
        text: "mongo: no documents in result",
      })
      .mockResolvedValueOnce({
        status: 200,
        text: JSON.stringify([
          {
            label: "English",
            file: "https://cache.vdrk.site/v1/vtt/movie/1363979/English.vtt",
          },
        ]),
      });

    const subtitles = await fetchScrapeFallbackSubtitles({
      mediaType: "movie",
      tmdbId: 1363979,
    });

    expect(subtitles).toHaveLength(1);
    expect(subtitles[0]?.lang).toBe("English");
  });
});
