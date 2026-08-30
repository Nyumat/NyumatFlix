import { describe, expect, it } from "vitest";

import { getExternalSubtitleId, type SubtitleSourceEntry } from "../types";

describe("external subtitle track identity", () => {
  it("uses explicit id when provided", () => {
    const track: SubtitleSourceEntry = {
      id: "scrape-english-abc123",
      url: "https://cdn.example/en.vtt",
      lang: "English",
      label: "English · JustAnime",
    };

    expect(getExternalSubtitleId(track)).toBe("scrape-english-abc123");
  });

  it("falls back to url when id is omitted", () => {
    const track: SubtitleSourceEntry = {
      url: "https://cdn.example/en-kickass.vtt",
      lang: "English",
      label: "English · KickAssAnime",
    };

    expect(getExternalSubtitleId(track)).toBe("https://cdn.example/en-kickass.vtt");
  });

  it("keeps ids unique for same-language tracks", () => {
    const tracks: SubtitleSourceEntry[] = [
      {
        id: "scrape-english-aaa",
        url: "https://cdn.example/a.vtt",
        lang: "English",
        label: "English · JustAnime",
      },
      {
        id: "scrape-english-bbb",
        url: "https://cdn.example/b.vtt",
        lang: "English",
        label: "English · KickAssAnime",
      },
    ];

    const ids = tracks.map(getExternalSubtitleId);
    expect(new Set(ids).size).toBe(2);
  });
});
