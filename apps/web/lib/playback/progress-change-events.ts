import { PLAYBACK_PROGRESS_STORAGE_KEY } from "@/lib/playback/progress-storage";
import { VIDSRC_PROGRESS_STORAGE_KEY } from "@/lib/playback/vidsrc-progress-storage";

export const PLAYBACK_PROGRESS_CHANGED_EVENT =
  "nyumatflix:playback-progress-changed";

let playbackProgressRevision = 0;

export const getPlaybackProgressRevision = (): number =>
  playbackProgressRevision;

export const notifyPlaybackProgressChanged = (): void => {
  if (typeof window === "undefined") {
    return;
  }

  playbackProgressRevision += 1;
  window.dispatchEvent(new CustomEvent(PLAYBACK_PROGRESS_CHANGED_EVENT));
};

export const subscribePlaybackProgressChanged = (
  listener: () => void,
): (() => void) => {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const onStorage = (event: StorageEvent) => {
    if (
      event.key === PLAYBACK_PROGRESS_STORAGE_KEY ||
      event.key === VIDSRC_PROGRESS_STORAGE_KEY
    ) {
      playbackProgressRevision += 1;
      listener();
    }
  };

  window.addEventListener(PLAYBACK_PROGRESS_CHANGED_EVENT, listener);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(PLAYBACK_PROGRESS_CHANGED_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
};
