import type { ErrorData, Level } from "hls.js";
import Hls from "hls.js";

const STALL_RECOVERY_DETAILS = new Set([
  "bufferStalledError",
  "bufferSeekOverHole",
  "bufferNudgeOnStall",
]);

const STALL_RECOVERY_COOLDOWN_MS = 2_000;
const STALL_RECOVERY_STARTUP_GRACE_MS = 5_000;
const UNRECOVERABLE_HLS_HTTP_STATUS = new Set([403, 404, 410, 451]);

export const PLAYING_FRAG_LOADING_TIMEOUT_MS = 15_000;
export const PLAYING_FRAG_LOADING_MAX_RETRY = 3;

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

export const pickHighestHlsLevelIndex = (levels: readonly Level[]): number => {
  let bestIndex = 0;
  let bestHeight = 0;

  for (let index = 0; index < levels.length; index += 1) {
    const height = inferHeightFromLevel(levels[index]!);
    if (height > bestHeight) {
      bestHeight = height;
      bestIndex = index;
    }
  }

  return bestIndex;
};

export const pickNextLowerHlsLevelIndex = (
  levels: readonly Level[],
  currentLevel: number,
): number | null => {
  if (currentLevel < 0 || currentLevel >= levels.length || levels.length < 2) {
    return null;
  }

  const currentHeight = inferHeightFromLevel(levels[currentLevel]!);
  let bestIndex: number | null = null;
  let bestHeight = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < levels.length; index += 1) {
    if (index === currentLevel) {
      continue;
    }

    const height = inferHeightFromLevel(levels[index]!);
    if (height <= 0 || height >= currentHeight || height <= bestHeight) {
      continue;
    }

    bestHeight = height;
    bestIndex = index;
  }

  return bestIndex;
};

export const nextScrapeHlsLevelAfterError = (
  levels: readonly Level[],
  currentLevel: number,
): number | null => {
  const lower = pickNextLowerHlsLevelIndex(levels, currentLevel);
  if (lower !== null) {
    return lower;
  }

  if (currentLevel >= 0 && levels.length > 1) {
    return -1;
  }

  return null;
};

export type BufferedMediaLike = {
  currentTime: number;
  buffered: {
    length: number;
    start: (index: number) => number;
    end: (index: number) => number;
  };
};

export const bufferedAheadSeconds = (
  media: BufferedMediaLike | null,
): number => {
  if (!media || media.buffered.length === 0) {
    return 0;
  }

  const playhead = media.currentTime;
  for (let index = 0; index < media.buffered.length; index += 1) {
    const start = media.buffered.start(index);
    const end = media.buffered.end(index);
    if (playhead >= start && playhead <= end) {
      return Math.max(0, end - playhead);
    }
  }

  return 0;
};

export const isScrapeHlsMidstream = (
  media: BufferedMediaLike | null,
): boolean => {
  if (!media) {
    return false;
  }

  return media.currentTime > 1 || bufferedAheadSeconds(media) > 1;
};

export const hlsErrorHttpStatus = (
  detail: Pick<ErrorData, "response">,
): number | undefined => {
  const code = detail.response?.code;
  return typeof code === "number" && Number.isFinite(code) ? code : undefined;
};

export const isUnrecoverableScrapeHlsError = (detail: ErrorData): boolean => {
  const status = hlsErrorHttpStatus(detail);
  if (status !== undefined && UNRECOVERABLE_HLS_HTTP_STATUS.has(status)) {
    return true;
  }

  return (
    detail.type === Hls.ErrorTypes.MUX_ERROR ||
    detail.type === Hls.ErrorTypes.KEY_SYSTEM_ERROR
  );
};

export type ScrapeHlsRecoveryBudget = {
  network: number;
  media: number;
};

export const scrapeHlsRecoveryBudget = (
  bufferedAhead: number,
): ScrapeHlsRecoveryBudget => {
  if (bufferedAhead >= 10) {
    return { network: 3, media: 2 };
  }

  if (bufferedAhead >= 3) {
    return { network: 2, media: 1 };
  }

  return { network: 1, media: 1 };
};

export type ScrapeHlsFatalRecoveryAction =
  | "fail-fast"
  | "unrecoverable"
  | "recover-network"
  | "recover-media"
  | "exhausted";

export const decideScrapeHlsFatalRecovery = (input: {
  midstream: boolean;
  unrecoverable: boolean;
  errorType: ErrorData["type"] | undefined;
  networkRetries: number;
  mediaRetries: number;
  budget: ScrapeHlsRecoveryBudget;
}): ScrapeHlsFatalRecoveryAction => {
  if (!input.midstream) {
    return "fail-fast";
  }

  if (input.unrecoverable) {
    return "unrecoverable";
  }

  if (
    input.errorType === Hls.ErrorTypes.NETWORK_ERROR &&
    input.networkRetries < input.budget.network
  ) {
    return "recover-network";
  }

  if (
    input.errorType === Hls.ErrorTypes.MEDIA_ERROR &&
    input.mediaRetries < input.budget.media
  ) {
    return "recover-media";
  }

  return "exhausted";
};

export const shouldFailoverScrapeHlsFatal = (
  detail: ErrorData,
  midstream: boolean,
): boolean => {
  if (!detail.fatal) {
    return false;
  }

  if (!midstream) {
    return true;
  }

  return isUnrecoverableScrapeHlsError(detail);
};

const markHlsErrorNonFatal = (detail: ErrorData): void => {
  detail.fatal = false;
};

const resumeLoadPosition = (hls: Hls): number => {
  const resumeAt = hls.media?.currentTime;
  return typeof resumeAt === "number" && Number.isFinite(resumeAt)
    ? resumeAt
    : -1;
};

export type ScrapeHlsInstanceOptions = {
  onRecoveryExhausted?: (detail: ErrorData) => void;
};

export const configureScrapeHlsInstance = (
  hls: Hls,
  options?: ScrapeHlsInstanceOptions,
) => {
  let lastStallRecoveryAt = 0;
  let manifestLoadedAt = 0;
  let networkRetries = 0;
  let mediaRetries = 0;
  let tightenedLoading = false;
  let downshifted = false;

  const downshiftOnError = () => {
    if (downshifted) {
      return;
    }

    const nextLevel = nextScrapeHlsLevelAfterError(
      hls.levels,
      hls.currentLevel,
    );
    if (nextLevel === null) {
      return;
    }

    downshifted = true;
    hls.currentLevel = nextLevel;
  };

  hls.on(Hls.Events.MANIFEST_PARSED, () => {
    manifestLoadedAt = Date.now();
    normalizeLevelHeights(hls.levels);
    hls.levels.splice(0, hls.levels.length, ...stripInvalidLevels(hls.levels));
    hls.currentLevel =
      hls.levels.length > 0 ? pickHighestHlsLevelIndex(hls.levels) : -1;
  });

  hls.on(Hls.Events.FRAG_LOADED, () => {
    networkRetries = 0;
    mediaRetries = 0;

    if (tightenedLoading) {
      return;
    }

    tightenedLoading = true;
    hls.config.fragLoadingTimeOut = PLAYING_FRAG_LOADING_TIMEOUT_MS;
    hls.config.fragLoadingMaxRetry = PLAYING_FRAG_LOADING_MAX_RETRY;
  });

  hls.on(Hls.Events.ERROR, (_event, detail) => {
    if (isRecoverableScrapeHlsStall(detail)) {
      const now = Date.now();
      if (now - manifestLoadedAt < STALL_RECOVERY_STARTUP_GRACE_MS) {
        return;
      }

      if (now - lastStallRecoveryAt < STALL_RECOVERY_COOLDOWN_MS) {
        return;
      }

      lastStallRecoveryAt = now;
      hls.startLoad(resumeLoadPosition(hls));
      return;
    }

    if (!detail.fatal) {
      return;
    }

    const media = hls.media;
    const action = decideScrapeHlsFatalRecovery({
      midstream: isScrapeHlsMidstream(media),
      unrecoverable: isUnrecoverableScrapeHlsError(detail),
      errorType: detail.type,
      networkRetries,
      mediaRetries,
      budget: scrapeHlsRecoveryBudget(bufferedAheadSeconds(media)),
    });

    if (action === "recover-network") {
      networkRetries += 1;
      if (networkRetries > 1) {
        downshiftOnError();
      }
      markHlsErrorNonFatal(detail);
      hls.startLoad(resumeLoadPosition(hls));
      return;
    }

    if (action === "recover-media") {
      mediaRetries += 1;
      downshiftOnError();
      markHlsErrorNonFatal(detail);
      hls.recoverMediaError();
      return;
    }

    if (action === "fail-fast") {
      return;
    }

    options?.onRecoveryExhausted?.(detail);
  });
};
