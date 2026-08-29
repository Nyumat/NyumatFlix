import type { ErrorData } from "hls.js";

export const LIVE_HLS_BASE_CONFIG = {
  enableWorker: true,
  maxBufferLength: 24,
} as const;

const DEGRADING_ERROR_DETAILS = new Set([
  "bufferSeekOverHole",
  "bufferStalledError",
  "bufferNudgeOnStall",
  "fragLoadError",
  "fragGap",
  "fragParsingError",
]);

export const HOLE_ERROR_WINDOW_MS = 20_000;
export const HOLE_ERROR_THRESHOLD = 2;
export const STABLE_PLAYBACK_MS = 90_000;
export const MIN_TOGGLE_INTERVAL_MS = 10_000;

export const isDegradingHlsError = (detail: ErrorData) => {
  if (detail.fatal) {
    return true;
  }

  return detail.details ? DEGRADING_ERROR_DETAILS.has(detail.details) : false;
};

export const shouldDisableLowLatency = (
  detail: ErrorData,
  recentDegradingErrors: number,
) => {
  if (detail.fatal) {
    return true;
  }

  if (!isDegradingHlsError(detail)) {
    return false;
  }

  return recentDegradingErrors >= HOLE_ERROR_THRESHOLD;
};

export const buildLiveHlsConfig = (lowLatencyMode: boolean) => ({
  ...LIVE_HLS_BASE_CONFIG,
  lowLatencyMode,
});
