type ProgressFlushHandler = () => void;

let activeFlush: ProgressFlushHandler | null = null;

export function registerPlaybackProgressFlush(
  handler: ProgressFlushHandler,
): void {
  activeFlush = handler;
}

export function unregisterPlaybackProgressFlush(
  handler: ProgressFlushHandler,
): void {
  if (activeFlush === handler) {
    activeFlush = null;
  }
}

export function flushPlaybackProgress(): void {
  activeFlush?.();
}
