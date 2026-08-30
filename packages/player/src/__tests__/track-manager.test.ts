import { describe, expect, it } from "vitest";
import { TrackManager } from "../core/TrackManager";
import type { VideoTrack } from "../types";

const videoTrack = (
  id: number,
  height: number,
  bitRate?: number,
): VideoTrack => ({
  id,
  type: "video",
  codec: "avc1",
  width: height * 16 / 9,
  height,
  frameRate: 30,
  bitRate,
  label: `${height}p`,
});

describe("TrackManager.selectHighestVideoTrack", () => {
  it("selects the highest height rendition instead of Auto", () => {
    const manager = new TrackManager();
    manager.setTracks([
      videoTrack(-1, 0),
      videoTrack(0, 480),
      videoTrack(1, 1080),
      videoTrack(2, 720),
    ]);

    expect(manager.selectHighestVideoTrack()).toBe(true);
    expect(manager.getActiveVideoTrack()?.id).toBe(1);
    expect(manager.getActiveVideoTrack()?.height).toBe(1080);
  });

  it("breaks height ties with bitrate", () => {
    const manager = new TrackManager();
    manager.setTracks([
      videoTrack(-1, 0),
      videoTrack(0, 1080, 4_000_000),
      videoTrack(1, 1080, 8_000_000),
    ]);

    expect(manager.selectHighestVideoTrack()).toBe(true);
    expect(manager.getActiveVideoTrack()?.id).toBe(1);
  });

  it("falls back to Auto when no manual renditions exist", () => {
    const manager = new TrackManager();
    manager.setTracks([videoTrack(-1, 0)]);

    expect(manager.selectHighestVideoTrack()).toBe(true);
    expect(manager.getActiveVideoTrack()?.id).toBe(-1);
  });
});
