import { describe, expect, it } from "vitest";

import {
  engineSourceUrl,
  isStreamPlayable,
  nextFallbackEngine,
  orderDirectStreamsForScrape,
  pickMoviTrackPrefs,
  playbackEngineCandidates,
  selectInitialEngine,
} from "../src/playback";
import type { DirectStream } from "../src/types";

const baseStream = (overrides: Partial<DirectStream>): DirectStream => ({
  name: "Test Release",
  resolution: "1080p",
  size: 4_000_000_000,
  url: "/api/direct/media?u=https%3A%2F%2Fexample.com%2Ffile",
  cached: true,
  hash: "abc",
  ...overrides,
});

describe("direct engine playback", () => {
  it("uses vidstack-direct for native mp4 streams", () => {
    const stream = baseStream({ playback: "direct", browserPlayable: true });
    expect(playbackEngineCandidates(stream)).toEqual(["vidstack-direct"]);
    expect(selectInitialEngine(stream)).toBe("vidstack-direct");
  });

  it("does not route mp4 through movi", () => {
    const stream = baseStream({
      playback: "direct",
      browserPlayable: true,
      fallbackUrl: "/api/direct/transcode/playlist?u=x",
    });
    expect(playbackEngineCandidates(stream)).toEqual([
      "vidstack-direct",
      "vidstack-hls",
    ]);
    expect(selectInitialEngine(stream)).toBe("vidstack-direct");
  });

  it("uses movi first for light extended mkv streams when transcode fallback exists", () => {
    const previous = globalThis.VideoDecoder;
    // @ts-expect-error test shim
    globalThis.VideoDecoder = class VideoDecoder {};
    try {
      const stream = baseStream({
        playback: "extended",
        browserPlayable: false,
        playbackHint: "movi-first",
        fileName: "movie.1080p.WEB-DL.H.265-FLUX.mkv",
        name: "movie.1080p.WEB-DL.H.265-FLUX.mkv",
        fallbackUrl: "/api/direct/transcode/playlist?u=x",
      });
      expect(playbackEngineCandidates(stream)).toEqual([
        "movi",
        "vidstack-hls",
        "vidstack-direct",
      ]);
      expect(selectInitialEngine(stream)).toBe("movi");
      expect(engineSourceUrl(stream, "movi")).toBe(stream.url);
    } finally {
      if (previous === undefined) {
        // @ts-expect-error test cleanup
        delete globalThis.VideoDecoder;
      } else {
        globalThis.VideoDecoder = previous;
      }
    }
  });

  it("uses progressive transcode first for mp4 remux streams", () => {
    const previous = globalThis.VideoDecoder;
    // @ts-expect-error test shim
    globalThis.VideoDecoder = class VideoDecoder {};
    try {
      const stream = baseStream({
        playback: "extended",
        browserPlayable: false,
        playbackHint: "hls-first",
        transcodeProfile: "ultra",
        fileName: "Avatar.2160p.UHDRemux.Hybrid.HDR.DV.mp4",
        name: "Avatar.2160p.UHDRemux.Hybrid.HDR.DV.mp4",
        size: 79_000_000_000,
        fallbackUrl: "/api/direct/transcode/stream?u=x&profile=ultra",
      });
      expect(playbackEngineCandidates(stream)).toEqual(["vidstack-direct"]);
      expect(selectInitialEngine(stream)).toBe("vidstack-direct");
      expect(engineSourceUrl(stream, "vidstack-direct")).toBe(
        "/api/direct/transcode/stream?u=x&profile=ultra",
      );
    } finally {
      if (previous === undefined) {
        // @ts-expect-error test cleanup
        delete globalThis.VideoDecoder;
      } else {
        globalThis.VideoDecoder = previous;
      }
    }
  });

  it("prefers transcode over movi for heavy uhd multi mp4 encodes", () => {
    const previous = globalThis.VideoDecoder;
    // @ts-expect-error test shim
    globalThis.VideoDecoder = class VideoDecoder {};
    try {
      const stream = baseStream({
        playback: "extended",
        browserPlayable: false,
        playbackHint: "hls-first",
        transcodeProfile: "heavy",
        fileName: "The.Wild.Robot.2024.2160p.UHD.BluRay.MULTi[Ben The Men].mp4",
        name: "The.Wild.Robot.2024.2160p.UHD.BluRay.MULTi[Ben The Men].mp4",
        size: 15_000_000_000,
        fallbackUrl: "/api/direct/transcode/playlist?u=x&profile=heavy",
      });
      expect(playbackEngineCandidates(stream)).toEqual([
        "vidstack-hls",
        "vidstack-direct",
      ]);
      expect(selectInitialEngine(stream)).toBe("vidstack-hls");
      expect(
        nextFallbackEngine(stream, "vidstack-hls", new Set(["vidstack-hls"])),
      ).toBe("vidstack-direct");
    } finally {
      if (previous === undefined) {
        // @ts-expect-error test cleanup
        delete globalThis.VideoDecoder;
      } else {
        globalThis.VideoDecoder = previous;
      }
    }
  });

  it("does not offer movi for heavy multi-audio mp4 when transcode exists", () => {
    const stream = baseStream({
      playback: "extended",
      browserPlayable: false,
      playbackHint: "hls-first",
      fileName: "Movie.2024.2160p.UHD.BluRay.MULTi.mp4",
      name: "Movie.2024.2160p.UHD.BluRay.MULTi.mp4",
      size: 20_000_000_000,
      fallbackUrl: "/api/direct/transcode/playlist?u=x",
    });
    expect(selectInitialEngine(stream)).toBe("vidstack-hls");
    expect(playbackEngineCandidates(stream)).toEqual([
      "vidstack-hls",
      "vidstack-direct",
    ]);
  });

  it("falls back from movi to vidstack-hls for extended streams", () => {
    const previous = globalThis.VideoDecoder;
    // @ts-expect-error test shim
    globalThis.VideoDecoder = class VideoDecoder {};
    try {
      const stream = baseStream({
        playback: "extended",
        browserPlayable: false,
        fallbackUrl: "/api/direct/transcode/playlist?u=x",
      });
      const tried = new Set(["movi"] as const);
      expect(nextFallbackEngine(stream, "movi", tried)).toBe("vidstack-hls");
    } finally {
      if (previous === undefined) {
        // @ts-expect-error test cleanup
        delete globalThis.VideoDecoder;
      } else {
        globalThis.VideoDecoder = previous;
      }
    }
  });

  it("uses vidstack-hls only for torbox hls streams", () => {
    const stream = baseStream({
      playback: "hls",
      url: "/api/direct/media?u=https%3A%2F%2Fexample.com%2Fstream.m3u8",
    });
    expect(playbackEngineCandidates(stream)).toEqual(["vidstack-hls"]);
  });

  it("prefers movi for light extended mkv when WebCodecs is available", () => {
    const previous = globalThis.VideoDecoder;
    // @ts-expect-error test shim
    globalThis.VideoDecoder = class VideoDecoder {};
    try {
      const stream = baseStream({
        playback: "extended",
        browserPlayable: false,
        fileName: "movie.1080p.WEB-DL.H.265-FLUX.mkv",
        name: "movie.1080p.WEB-DL.H.265-FLUX.mkv",
        fallbackUrl: "/api/direct/transcode/playlist?u=x",
      });
      expect(playbackEngineCandidates(stream)).toEqual([
        "movi",
        "vidstack-hls",
        "vidstack-direct",
      ]);
      expect(selectInitialEngine(stream)).toBe("movi");
    } finally {
      if (previous === undefined) {
        // @ts-expect-error test cleanup
        delete globalThis.VideoDecoder;
      } else {
        globalThis.VideoDecoder = previous;
      }
    }
  });

  it("ignores hls-first hints on mkv and prefers server transcode", () => {
    const previous = globalThis.VideoDecoder;
    // @ts-expect-error test shim
    globalThis.VideoDecoder = class VideoDecoder {};
    try {
      const stream = baseStream({
        playback: "extended",
        browserPlayable: false,
        playbackHint: "hls-first",
        fileName: "movie.1080p.WEB-DL.H.265-FLUX.mkv",
        name: "movie.1080p.WEB-DL.H.265-FLUX.mkv",
        fallbackUrl: "/api/direct/transcode/playlist?u=x",
      });
      expect(selectInitialEngine(stream)).toBe("vidstack-hls");
      expect(playbackEngineCandidates(stream)).toEqual([
        "vidstack-hls",
        "vidstack-direct",
        "movi",
      ]);
      expect(nextFallbackEngine(stream, "movi", new Set(["movi"]))).toBe(
        "vidstack-hls",
      );
    } finally {
      if (previous === undefined) {
        // @ts-expect-error test cleanup
        delete globalThis.VideoDecoder;
      } else {
        globalThis.VideoDecoder = previous;
      }
    }
  });

  it("stays on movi for dual-audio mkv instead of falling back to vidstack", () => {
    const previous = globalThis.VideoDecoder;
    // @ts-expect-error test shim
    globalThis.VideoDecoder = class VideoDecoder {};
    try {
      const stream = baseStream({
        playback: "extended",
        browserPlayable: false,
        playbackHint: "movi-first",
        fileName: "Darker than BLACK 2007 S01E01-[1080p][BDRIP][AV1.OPUS].mkv",
        name: "Darker than BLACK 2007 S01E01-[1080p][BDRIP][AV1.OPUS].mkv",
        fallbackUrl: "/api/direct/transcode/playlist?u=x",
      });
      expect(selectInitialEngine(stream)).toBe("movi");
      expect(nextFallbackEngine(stream, "movi", new Set(["movi"]))).toBeNull();
    } finally {
      if (previous === undefined) {
        // @ts-expect-error test cleanup
        delete globalThis.VideoDecoder;
      } else {
        globalThis.VideoDecoder = previous;
      }
    }
  });

  it("stays on movi for dual-sub and dual-audio filenames", () => {
    const dualSub = baseStream({
      playback: "extended",
      browserPlayable: false,
      fileName: "Show.S01E01.1080p.WEB-DL.Dual.Audio.Dual.Sub.mkv",
      name: "Show.S01E01.1080p.WEB-DL.Dual.Audio.Dual.Sub.mkv",
      fallbackUrl: "/api/direct/transcode/playlist?u=x",
    });
    expect(selectInitialEngine(dualSub)).toBe("movi");
    expect(nextFallbackEngine(dualSub, "movi", new Set(["movi"]))).toBeNull();

    const jaEn = baseStream({
      playback: "extended",
      browserPlayable: false,
      playbackHint: "hls-first",
      fileName: "Movie.2024.1080p.BluRay.JA+EN.mp4",
      name: "Movie.2024.1080p.BluRay.JA+EN.mp4",
      fallbackUrl: "/api/direct/transcode/playlist?u=x",
    });
    expect(selectInitialEngine(jaEn)).toBe("movi");
    expect(nextFallbackEngine(jaEn, "movi", new Set(["movi"]))).toBeNull();
  });

  it("plays a 4k hevc remux with movi when that is all we have", () => {
    const stream = baseStream({
      playback: "extended",
      browserPlayable: false,
      name: "Game.of.Thrones.S01E03.Lord.Snow.2160p.BluRay.HDR10.10bit.x265.HEVC.TrueHD.Atmos.7.1-PHOCiS.mkv",
      fileName:
        "Game.of.Thrones.S01E03.Lord.Snow.2160p.BluRay.HDR10.10bit.x265.HEVC.TrueHD.Atmos.7.1-PHOCiS.mkv",
      size: 4_742_854_249,
    });
    expect(selectInitialEngine(stream)).toBe("movi");
    expect(isStreamPlayable(stream)).toBe(true);
    expect(engineSourceUrl(stream, "movi")).toBe(stream.url);
  });

  it("prefers server transcode over movi for heavy remux with fallback", () => {
    const stream = baseStream({
      playback: "extended",
      browserPlayable: false,
      fileName:
        "Coraline 2009 2160p UHD BluRay DV REMUX HDR10 HEVC TrueHD 7 1 Atmos-UnKn0wn.mkv",
      name: "Coraline 2009 2160p UHD BluRay DV REMUX",
      size: 55_000_000_000,
      fallbackUrl: "/api/direct/transcode/playlist?u=x&profile=ultra",
    });
    expect(playbackEngineCandidates(stream)).toEqual([
      "vidstack-hls",
      "vidstack-direct",
    ]);
    expect(selectInitialEngine(stream)).toBe("vidstack-hls");
    expect(
      nextFallbackEngine(stream, "vidstack-hls", new Set(["vidstack-hls"])),
    ).toBe("vidstack-direct");
  });

  it("prefers server transcode for monster-house-scale encodes", () => {
    const stream = baseStream({
      playback: "extended",
      browserPlayable: false,
      name: "Monster.House.2006.4K.Upscale.BDRip.x265.Dolby.TrueHD.5.1.mkv",
      fileName: "Monster.House.2006.4K.Upscale.BDRip.x265.Dolby.TrueHD.5.1.mkv",
      size: 39_138_116_210,
      fallbackUrl: "/api/direct/transcode/playlist?u=x&profile=heavy",
    });
    expect(playbackEngineCandidates(stream)).toEqual([
      "vidstack-hls",
      "vidstack-direct",
    ]);
    expect(selectInitialEngine(stream)).toBe("vidstack-hls");
    expect(
      nextFallbackEngine(stream, "vidstack-hls", new Set(["vidstack-hls"])),
    ).toBe("vidstack-direct");
  });

  it("treats notWebReady remux as playable via movi", () => {
    const previous = globalThis.VideoDecoder;
    // @ts-expect-error test shim
    globalThis.VideoDecoder = class VideoDecoder {};
    try {
      const stream = baseStream({
        playback: "extended",
        browserPlayable: false,
        notWebReady: true,
        playbackHint: "movi-first",
        name: "Avatar.2160p.UHD.BluRay.REMUX.HEVC.mkv",
        fileName: "Avatar.2160p.UHD.BluRay.REMUX.HEVC.mkv",
      });
      expect(selectInitialEngine(stream)).toBe("movi");
      expect(isStreamPlayable(stream)).toBe(true);
    } finally {
      if (previous === undefined) {
        // @ts-expect-error test cleanup
        delete globalThis.VideoDecoder;
      } else {
        globalThis.VideoDecoder = previous;
      }
    }
  });
});

describe("anime direct scrape track prefs", () => {
  it("prefers dual-audio remuxes before browser mp4 when asked", () => {
    const mp4 = {
      name: "Naruto.S01E01.1080p.mp4",
      fileName: "Naruto.S01E01.1080p.mp4",
      playback: "direct" as const,
      browserPlayable: true,
      size: 800_000_000,
    };
    const dual = {
      name: "Naruto.S01E01.1080p.Dual.Audio.mkv",
      fileName: "Naruto.S01E01.1080p.BluRay.Dual.Audio.mkv",
      playback: "extended" as const,
      browserPlayable: false,
      size: 2_000_000_000,
    };

    expect(orderDirectStreamsForScrape([mp4, dual], false)[0]?.name).toBe(
      mp4.name,
    );
    expect(orderDirectStreamsForScrape([mp4, dual], true)[0]?.name).toBe(
      dual.name,
    );
  });

  it("selects english audio for dub and japanese audio plus english subs for sub", () => {
    const audio = [
      { lang: "jpn", label: "Japanese" },
      { lang: "eng", label: "English" },
    ];
    const subs = [{ lang: "en", label: "English" }];

    expect(pickMoviTrackPrefs(audio, subs, "eng")).toEqual({
      audioLang: "eng",
      subtitleLang: null,
    });
    expect(pickMoviTrackPrefs(audio, subs, "jpn")).toEqual({
      audioLang: "jpn",
      subtitleLang: "en",
    });
  });
});
