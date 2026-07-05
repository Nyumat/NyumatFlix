import { describe, expect, it } from "vitest";

import {
  buildVidnestMediaPath,
  mapVidnestCaptions,
  pickVidnestStreamUrl,
} from "@/lib/scrape/vidnest-shared";
import { decodeVidnestPayload } from "@/lib/scrape/vidnest-crypto";

describe("vidnest scrape helpers", () => {
  it("builds movie and tv media paths", () => {
    expect(buildVidnestMediaPath({ mediaType: "movie", tmdbId: 550 })).toBe(
      "movie/550",
    );
    expect(
      buildVidnestMediaPath({
        mediaType: "tv",
        tmdbId: 1399,
        seasonNumber: 1,
        episodeNumber: 1,
      }),
    ).toBe("tv/1399/1/1");
    expect(buildVidnestMediaPath({ mediaType: "tv", tmdbId: 1399 })).toBeNull();
  });

  it("prefers HLS streams and English when available", () => {
    const url = pickVidnestStreamUrl([
      {
        type: "mp4",
        language: "MAIN",
        url: "https://cdn.example/video.mp4",
      },
      {
        type: "hls",
        language: "Hindi",
        url: "https://cdn.example/hindi.m3u8",
      },
      {
        type: "hls",
        language: "English",
        url: "https://cdn.example/english.m3u8",
      },
    ]);

    expect(url).toBe("https://cdn.example/english.m3u8");
  });

  it("maps captions to subtitle tracks", () => {
    expect(
      mapVidnestCaptions([
        { lan: "en", lanName: "English", url: "https://cdn.example/en.srt" },
        { lan: "en", lanName: "English", url: "https://cdn.example/en.srt" },
      ]),
    ).toEqual([{ lang: "English", url: "https://cdn.example/en.srt" }]);
  });

  it("decodes VidNest custom-base64 payloads", () => {
    const encoded =
      "lOybxZyG35gbEsXFlOywx5HUKui4EsmT6p2TL0ybFPJO3QAT7TycD8NXF6RrEHIXIuibx5E1Ebp1VpIgF8jXETjTxZGjI6EhEaNUDOEUEqJOF0EhEaNCxZBb7TezxaGjLaWjDPiOI5HrkMAt3QWrLbEjksEjkbECLbp4vsIS7M3bkMyTvbnzK54nIu1tFMvg70yWuuCV";
    const decoded = decodeVidnestPayload(encoded);

    expect(decoded.startsWith("{")).toBe(true);
    expect(decoded).toContain('"streams"');
  });
});
