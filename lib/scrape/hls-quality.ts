import type { ErrorData, Level } from "hls.js";
import Hls from "hls.js";

const STALL_RECOVERY_DETAILS = new Set([
  "bufferStalledError",
  "bufferSeekOverHole",
  "bufferNudgeOnStall",
]);

const STALL_RECOVERY_COOLDOWN_MS = 2_000;

/** HLS renditions without a parsed height show up as "0p" in Vidstack's quality menu. */
export const isRenderableVideoQualityHeight = (height: number): boolean =>
  Number.isFinite(height) && height > 0;

const inferHeightFromLevel = (level: Level): number => {
  if (isRenderableVideoQualityHeight(level.height)) {
    return level.height;
  }

  const rawUrl = level.url ?? "";
  const url = Array.isArray(rawUrl) ? (rawUrl[0] ?? "") : rawUrl;
  const match = url.match(/\/(\d{3,4})p\//i);
  if (!match?.[1]) {
    return 0;
  }

  const height = Number.parseInt(match[1], 10);
  return Number.isFinite(height) && height > 0 ? height : 0;
};

const normalizeLevelHeights = (levels: Level[]) => {
  for (const level of levels) {
    const inferred = inferHeightFromLevel(level);
    if (inferred > 0) {
      Object.assign(level, { height: inferred });
    }
  }
};

const stripInvalidLevels = (levels: Level[]) => {
  const renderable = levels.filter((level) =>
    isRenderableVideoQualityHeight(inferHeightFromLevel(level)),
  );

  if (renderable.length === 0) {
    return levels;
  }

  return renderable;
};

export const isRecoverableScrapeHlsStall = (detail: ErrorData) =>
  !detail.fatal &&
  Boolean(detail.details && STALL_RECOVERY_DETAILS.has(detail.details));

const STALL_RECOVERY_STARTUP_GRACE_MS = 5_000;

export const configureScrapeHlsInstance = (hls: Hls) => {
  let lastStallRecoveryAt = 0;
  let manifestLoadedAt = 0;

  hls.on(Hls.Events.MANIFEST_PARSED, () => {
    manifestLoadedAt = Date.now();
    normalizeLevelHeights(hls.levels);
    hls.levels.splice(0, hls.levels.length, ...stripInvalidLevels(hls.levels));
    hls.currentLevel = -1;
  });

  hls.on(Hls.Events.ERROR, (_event, detail) => {
    if (!isRecoverableScrapeHlsStall(detail)) {
      return;
    }

    const now = Date.now();
    if (now - manifestLoadedAt < STALL_RECOVERY_STARTUP_GRACE_MS) {
      return;
    }

    if (now - lastStallRecoveryAt < STALL_RECOVERY_COOLDOWN_MS) {
      return;
    }

    lastStallRecoveryAt = now;
    hls.startLoad(0);
  });
};
