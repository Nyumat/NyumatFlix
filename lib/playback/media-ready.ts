export type MediaReadyCallback = () => void;

export function createMediaReadyHandler(
  onMediaReady: MediaReadyCallback | undefined,
  settledRef: { current: boolean },
): MediaReadyCallback {
  return () => {
    if (settledRef.current) {
      return;
    }
    settledRef.current = true;
    onMediaReady?.();
  };
}
