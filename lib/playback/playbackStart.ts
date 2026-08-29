import Hls from "hls.js";
import { isDirectProgressiveTranscodePath } from "@/lib/direct/playback";

export type VidstackStartGuardEngine = "vidstack-hls" | "vidstack-direct";

export function shouldEnforceVidstackStartAtZero(
  engine: VidstackStartGuardEngine,
  sourceUrl: string,
  resumeTime = 0,
): boolean {
  if (resumeTime > 0) {
    return false;
  }
  if (engine === "vidstack-hls") {
    return true;
  }
  return isDirectProgressiveTranscodePath(sourceUrl);
}

export function hlsStartPosition(resumeTime: number): number {
  return resumeTime > 0 ? resumeTime : 0;
}

export const START_DRIFT_TOLERANCE_SEC = 2;

/** How long to wait for first frame before failing over to another source. */
export const PLAYBACK_START_TIMEOUT_MS = 45_000;

export const HLS_START_AT_ZERO_CONFIG = {
  startPosition: 0,
  liveSyncMode: "buffered" as const,
  liveSyncDurationCount: 1,
};

export function isStartPositionDrifted(currentTime: number): boolean {
  return (
    Number.isFinite(currentTime) && currentTime > START_DRIFT_TOLERANCE_SEC
  );
}

export function canReportPlaybackReady(currentTime: number): boolean {
  if (!Number.isFinite(currentTime)) {
    return false;
  }
  return !isStartPositionDrifted(currentTime);
}

export type PlaybackAutoStartDecision = "already-playing" | "start" | "skip";

export const decidePlaybackAutoStart = (options: {
  autoPlay: boolean;
  hasStarted: boolean;
  isCurrentlyPlaying: boolean;
}): PlaybackAutoStartDecision => {
  if (!options.autoPlay) {
    return "skip";
  }
  if (options.isCurrentlyPlaying) {
    return "already-playing";
  }
  if (options.hasStarted) {
    return "skip";
  }
  return "start";
};

export interface SeekableCurrentTime {
  currentTime?: number;
}

export function seekMediaToStart(media: SeekableCurrentTime): boolean {
  const currentTime = media.currentTime;
  if (typeof currentTime !== "number" || !Number.isFinite(currentTime)) {
    return true;
  }
  if (!isStartPositionDrifted(currentTime)) {
    return true;
  }
  try {
    media.currentTime = 0;
  } catch {
    return false;
  }
  return true;
}

export function ensurePlaybackAtStart(media: SeekableCurrentTime): boolean {
  return seekMediaToStart(media);
}

export function bindHlsStartPosition(
  hls: Hls,
  getMedia: () => HTMLMediaElement | null,
  startAt = 0,
): () => void {
  let enforced = false;
  const enforceStart = () => {
    if (enforced) {
      return;
    }
    enforced = true;
    hls.startLoad(startAt);
    const media = getMedia();
    if (!media) {
      return;
    }
    if (startAt > 0) {
      try {
        media.currentTime = startAt;
      } catch {
        return;
      }
      return;
    }
    seekMediaToStart(media);
  };

  hls.on(Hls.Events.MANIFEST_PARSED, enforceStart);

  return () => {
    hls.off(Hls.Events.MANIFEST_PARSED, enforceStart);
  };
}

export function bindHlsStartAtZero(
  hls: Hls,
  getMedia: () => HTMLMediaElement | null,
): () => void {
  return bindHlsStartPosition(hls, getMedia, 0);
}
