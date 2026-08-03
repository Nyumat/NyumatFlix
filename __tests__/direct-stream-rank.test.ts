import { describe, expect, it } from "vitest";

import {
  directStreamPickScore,
  rankDirectStreams,
} from "@calluspirates/shared";

describe("direct-stream-rank", () => {
  it("prefers browser-playable direct mp4 over 2160p extended remux (Shrek-style)", () => {
    const streams = [
      {
        name: "Shrek 2160p REMUX HEVC",
        resolution: "2160p",
        fileName:
          "Shrek.2001.NORDiC.ENG.REMUX.2160p.HDR.UHD-BluRay.HEVC.DTS-HD.MA.7.1-RAPiDCOWS.mkv",
        playback: "extended",
        browserPlayable: true,
      },
      {
        name: "Shrek 1080p TorBox",
        resolution: "1080p",
        fileName: "Shrek.2001.1080p.mp4",
        playback: "direct",
        browserPlayable: true,
      },
    ];

    const ranked = rankDirectStreams(streams);
    expect(ranked[0]?.playback).toBe("direct");
  });

  it("excludes stereoscopic layouts without rejecting titles containing 3D", () => {
    const streams = [
      {
        name: "Shrek.2.3D.2004.1080p.H-OU.Multi.BluRay",
        resolution: "1080p",
        playback: "extended",
      },
      {
        name: "Piranha.3D.2010.1080p.BluRay.x264",
        resolution: "1080p",
        playback: "extended",
      },
    ];

    const ranked = rankDirectStreams(streams);
    expect(ranked.map((stream) => stream.name)).toEqual([
      "Piranha.3D.2010.1080p.BluRay.x264",
    ]);
  });
});
