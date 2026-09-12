import type { VideoTrack } from "../types";

export const NATIVE_VIDEO_FRAME_WAIT_MS = 8_000;

export class NativeVideoFrameTimeoutError extends Error {
  constructor() {
    super("Native stream attached without a decoded video frame");
    this.name = "NativeVideoFrameTimeoutError";
  }
}

export function hasDecodedVideoFrame(video: {
  videoWidth: number;
  videoHeight: number;
}): boolean {
  return video.videoWidth > 0 && video.videoHeight > 0;
}

export function streamExpectsVideoPicture(
  tracks: readonly Pick<VideoTrack, "id" | "codec" | "isAttachedPic">[],
): boolean {
  return tracks.some((track) => {
    if (track.id === -1) return false;
    if (track.isAttachedPic) return false;
    const codec = (track.codec || "").toLowerCase();
    return codec !== "auto";
  });
}

type NativeVideoFrameTarget = {
  videoWidth: number;
  videoHeight: number;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
};

export function waitForDecodedVideoFrame(
  video: NativeVideoFrameTarget,
  timeoutMs: number = NATIVE_VIDEO_FRAME_WAIT_MS,
): Promise<void> {
  if (hasDecodedVideoFrame(video)) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const onMaybeFrame = () => {
      if (!hasDecodedVideoFrame(video)) return;
      cleanup();
      resolve();
    };

    const onTimeout = () => {
      cleanup();
      reject(new NativeVideoFrameTimeoutError());
    };

    const cleanup = () => {
      globalThis.clearTimeout(timer);
      video.removeEventListener("loadeddata", onMaybeFrame);
      video.removeEventListener("loadedmetadata", onMaybeFrame);
      video.removeEventListener("resize", onMaybeFrame);
      video.removeEventListener("playing", onMaybeFrame);
    };

    const timer = globalThis.setTimeout(onTimeout, timeoutMs);
    video.addEventListener("loadeddata", onMaybeFrame);
    video.addEventListener("loadedmetadata", onMaybeFrame);
    video.addEventListener("resize", onMaybeFrame);
    video.addEventListener("playing", onMaybeFrame);
  });
}
