import { describe, expect, it } from "vitest";

import type { VideoTrack } from "../types";
import {
  hasDecodedVideoFrame,
  NativeVideoFrameTimeoutError,
  streamExpectsVideoPicture,
  waitForDecodedVideoFrame,
} from "../core/native-video-frame";

const videoTrack = (
  partial: Partial<VideoTrack> & Pick<VideoTrack, "id">,
): VideoTrack => ({
  type: "video",
  codec: "",
  width: 0,
  height: 0,
  frameRate: 0,
  ...partial,
});

describe("streamExpectsVideoPicture", () => {
  it("ignores the Auto ABR placeholder", () => {
    expect(
      streamExpectsVideoPicture([
        videoTrack({ id: -1, codec: "auto", label: "Auto" }),
      ]),
    ).toBe(false);
  });

  it("expects a picture when a real video rendition exists", () => {
    expect(
      streamExpectsVideoPicture([
        videoTrack({ id: -1, codec: "auto", label: "Auto" }),
        videoTrack({
          id: 0,
          codec: "hvc1",
          width: 1920,
          height: 1080,
          label: "1080p",
        }),
      ]),
    ).toBe(true);
  });

  it("expects a picture for progressive video even without a codec string", () => {
    expect(
      streamExpectsVideoPicture([
        videoTrack({ id: 0, codec: "", width: 1920, height: 1080 }),
      ]),
    ).toBe(true);
  });

  it("ignores attached cover art", () => {
    expect(
      streamExpectsVideoPicture([
        videoTrack({
          id: 0,
          codec: "png",
          isAttachedPic: true,
          width: 600,
          height: 600,
        }),
      ]),
    ).toBe(false);
  });
});

describe("hasDecodedVideoFrame", () => {
  it("requires both width and height", () => {
    expect(hasDecodedVideoFrame({ videoWidth: 0, videoHeight: 0 })).toBe(false);
    expect(hasDecodedVideoFrame({ videoWidth: 1920, videoHeight: 0 })).toBe(
      false,
    );
    expect(hasDecodedVideoFrame({ videoWidth: 1920, videoHeight: 800 })).toBe(
      true,
    );
  });
});

describe("waitForDecodedVideoFrame", () => {
  it("resolves immediately when a frame is already present", async () => {
    await expect(
      waitForDecodedVideoFrame(
        {
          videoWidth: 1920,
          videoHeight: 800,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
        },
        20,
      ),
    ).resolves.toBeUndefined();
  });

  it("rejects when no frame arrives before the timeout", async () => {
    await expect(
      waitForDecodedVideoFrame(
        {
          videoWidth: 0,
          videoHeight: 0,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
        },
        20,
      ),
    ).rejects.toBeInstanceOf(NativeVideoFrameTimeoutError);
  });
});
