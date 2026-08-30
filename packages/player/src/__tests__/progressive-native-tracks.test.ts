import { describe, expect, it } from "vitest";
import { TrackManager } from "../core/TrackManager";
import { buildProgressiveNativeTracks } from "../render/ProgressiveVideoWrapper";

describe("buildProgressiveNativeTracks", () => {
  it("registers a video track so native mp4 is not treated as audio-only", () => {
    const tracks = buildProgressiveNativeTracks({
      videoWidth: 1920,
      videoHeight: 1080,
    });
    const manager = new TrackManager();
    manager.setTracks(tracks);

    expect(manager.getActiveVideoTrack()).toEqual(
      expect.objectContaining({
        type: "video",
        width: 1920,
        height: 1080,
        label: "1080p",
      }),
    );
    expect(manager.getAudioTracks()).toHaveLength(1);
  });

  it("omits a video track when the element has no picture", () => {
    const tracks = buildProgressiveNativeTracks({
      videoWidth: 0,
      videoHeight: 0,
    });
    const manager = new TrackManager();
    manager.setTracks(tracks);

    expect(manager.getActiveVideoTrack()).toBeNull();
    expect(manager.getAudioTracks()).toHaveLength(1);
  });
});
