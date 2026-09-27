const livePlayheads = new Map<string, number>();

/** New sources tick up from zero before the resume seek lands. */
const RESTART_FLOOR_SECONDS = 15;

export function rememberLivePlayhead(
  storageKey: string,
  seconds: number,
): void {
  if (!storageKey || !Number.isFinite(seconds) || seconds <= 1) {
    return;
  }

  const previous = livePlayheads.get(storageKey) ?? 0;
  if (previous > RESTART_FLOOR_SECONDS && seconds < RESTART_FLOOR_SECONDS) {
    return;
  }

  livePlayheads.set(storageKey, seconds);
}

export function readLivePlayhead(storageKey: string): number {
  const value = livePlayheads.get(storageKey);
  return typeof value === "number" && Number.isFinite(value) && value > 1
    ? value
    : 0;
}

export function clearLivePlayhead(storageKey: string): void {
  livePlayheads.delete(storageKey);
}

/** Prefer the live playhead so a source switch continues where playback stopped. */
export function sourceSwitchStartPosition(
  storedResumeSeconds: number,
  livePlayheadSeconds: number,
): number {
  if (Number.isFinite(livePlayheadSeconds) && livePlayheadSeconds > 1) {
    return livePlayheadSeconds;
  }

  if (Number.isFinite(storedResumeSeconds) && storedResumeSeconds > 0) {
    return storedResumeSeconds;
  }

  return 0;
}
