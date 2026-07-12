import { describe, expect, it } from "vitest";

import {
  buildVidnestMediaPath,
  extractVidnestStreams,
  isFreshVidnestSignedUrl,
  isVidnestClientOnlyCdn,
  mapVidnestCaptions,
  pickVidnestStreamUrl,
  rankVidnestStreamUrls,
  refererForVidnestStream,
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

  it("keeps secondary resolver streams available for validation fallback", () => {
    expect(
      rankVidnestStreamUrls([
        { type: "hls", url: "https://blocked.example/master.m3u8" },
        { type: "cloudflare", url: "https://working.example/cf-master.txt" },
      ]),
    ).toEqual([
      "https://blocked.example/master.m3u8",
      "https://working.example/cf-master.txt",
    ]);
    expect(
      refererForVidnestStream("https://working.example/cf-master.txt"),
    ).toBe("https://working.example/");
    expect(
      refererForVidnestStream("https://bcdn.hakunaymatata.com/videos/foo.mp4"),
    ).toBe("");
    expect(
      isVidnestClientOnlyCdn("https://bcdnxw.hakunaymatata.com/foo.mp4"),
    ).toBe(true);
  });

  it("normalizes movies5f downloads and moviebox url payloads", () => {
    expect(
      extractVidnestStreams({
        code: 0,
        data: {
          downloads: [
            { url: "https://bcdn.hakunaymatata.com/a.mp4", resolution: 720 },
            { url: "https://bcdn.hakunaymatata.com/b.mp4", resolution: 1080 },
          ],
        },
      }),
    ).toEqual([
      {
        url: "https://bcdn.hakunaymatata.com/a.mp4",
        type: "mp4",
        language: "720p",
      },
      {
        url: "https://bcdn.hakunaymatata.com/b.mp4",
        type: "mp4",
        language: "1080p",
      },
    ]);

    expect(
      extractVidnestStreams({
        provider: "MovieBox",
        url: [
          {
            lang: "en",
            link: "https://cdn.example/movie.mp4",
            resolution: "1080",
            type: "mp4",
          },
        ],
      }),
    ).toEqual([
      {
        url: "https://cdn.example/movie.mp4",
        type: "mp4",
        language: "en",
      },
    ]);

    expect(
      extractVidnestStreams({
        streams: [
          {
            headers: { Referer: "https://gemma416okl.com" },
            language: "English",
            type: "hls",
            url: "https://cdn.example/master.m3u8",
          },
        ],
      }),
    ).toEqual([
      {
        url: "https://cdn.example/master.m3u8",
        type: "hls",
        language: "English",
        referer: "https://gemma416okl.com",
      },
    ]);
  });

  it("maps captions to subtitle tracks", () => {
    expect(
      mapVidnestCaptions([
        { lan: "en", lanName: "English", url: "https://cdn.example/en.srt" },
        { lan: "en", lanName: "English", url: "https://cdn.example/en.srt" },
      ]),
    ).toEqual([{ lang: "English", url: "https://cdn.example/en.srt" }]);
  });

  it("checks signed hakunaymatata URLs", () => {
    const signed =
      "https://bcdn.hakunaymatata.com/a.mp4?sign=0504f0cf8ae04f5935eb96c4c2b7db53&t=1783806546";

    expect(isFreshVidnestSignedUrl(signed)).toBe(true);
    expect(
      isFreshVidnestSignedUrl(
        "https://bcdn.hakunaymatata.com/a.mp4?t=1783806546",
      ),
    ).toBe(false);
    expect(isFreshVidnestSignedUrl("https://cdn.example/master.m3u8")).toBe(
      false,
    );
  });

  it("decodes VidNest custom-base64 payloads", () => {
    const encoded =
      "lOybxZyG35gbEsXFlOywx5HUKui4EsmT6p2TL0ybFPJO3QAT7TycD8NXF6RrEHIXIuibx5E1Ebp1VpIgF8jXETjTxZGjI6EhEaNUDOEUEqJOF0EhEaNCxZBb7TezxaGjLaWjDPiOI5HrkMAt3QWrLbEjksEjkbECLbp4vsIS7M3bkMyTvbnzK54nIu1tFMvg70yWuuCV";
    const decoded = decodeVidnestPayload(encoded);

    expect(decoded.startsWith("{")).toBe(true);
    expect(decoded).toContain('"streams"');
  });
});
