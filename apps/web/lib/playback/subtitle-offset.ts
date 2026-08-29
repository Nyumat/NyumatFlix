export const SUBTITLE_OFFSET_MIN_SECONDS = -10;
export const SUBTITLE_OFFSET_MAX_SECONDS = 10;
export const SUBTITLE_OFFSET_STEP_SECONDS = 0.1;
export const SUBTITLE_OFFSET_SHIFT_STEP_SECONDS = 1;

export type OffsetableCue = {
  startTime: number;
  endTime: number;
};

const cueOriginals = new WeakMap<
  OffsetableCue,
  { start: number; end: number }
>();

export const clampSubtitleOffset = (seconds: number): number => {
  if (!Number.isFinite(seconds)) {
    return 0;
  }

  const rounded = Math.round(seconds * 10) / 10;
  return Math.min(
    SUBTITLE_OFFSET_MAX_SECONDS,
    Math.max(SUBTITLE_OFFSET_MIN_SECONDS, rounded),
  );
};

export const formatSubtitleOffsetLabel = (seconds: number): string => {
  const clamped = clampSubtitleOffset(seconds);
  if (clamped === 0) {
    return "0.0s";
  }

  const sign = clamped > 0 ? "+" : "";
  return `${sign}${clamped.toFixed(1)}s`;
};

export const nudgeSubtitleOffset = (
  current: number,
  direction: 1 | -1,
  coarse = false,
): number => {
  const step = coarse
    ? SUBTITLE_OFFSET_SHIFT_STEP_SECONDS
    : SUBTITLE_OFFSET_STEP_SECONDS;
  return clampSubtitleOffset(current + direction * step);
};

export const listOffsetableCues = (
  cues: Iterable<OffsetableCue> | ArrayLike<OffsetableCue> | null | undefined,
): OffsetableCue[] => {
  if (!cues) {
    return [];
  }

  return Array.from(cues as ArrayLike<OffsetableCue>).filter(
    (cue): cue is OffsetableCue =>
      Boolean(cue) &&
      typeof cue.startTime === "number" &&
      typeof cue.endTime === "number",
  );
};

export const applySubtitleCueOffset = (
  cues: Iterable<OffsetableCue> | ArrayLike<OffsetableCue> | null | undefined,
  offsetSeconds: number,
): void => {
  const clamped = clampSubtitleOffset(offsetSeconds);

  for (const cue of listOffsetableCues(cues)) {
    let original = cueOriginals.get(cue);
    if (!original) {
      original = { start: cue.startTime, end: cue.endTime };
      cueOriginals.set(cue, original);
    }

    cue.startTime = original.start + clamped;
    cue.endTime = original.end + clamped;
  }
};
