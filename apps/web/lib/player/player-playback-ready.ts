export interface MoviHostElement extends HTMLElement {
  shadowRoot: ShadowRoot | null;
  currentTime?: number;
}

export function getMoviVideoElement(
  player: MoviHostElement,
): HTMLVideoElement | null {
  const fromShadow = player.shadowRoot?.querySelector("video");
  if (fromShadow instanceof HTMLVideoElement) {
    return fromShadow;
  }
  const fromLight = player.querySelector("video");
  return fromLight instanceof HTMLVideoElement ? fromLight : null;
}

export function isMoviVideoPlaybackReady(video: HTMLVideoElement): boolean {
  return video.readyState >= 2;
}

const lastObservedTime = new WeakMap<MoviHostElement, number>();

export function isMoviPlayerMakingProgress(player: MoviHostElement): boolean {
  const video = getMoviVideoElement(player);
  if (video) {
    if (video.readyState >= 2 && !video.paused) {
      lastObservedTime.set(player, video.currentTime);
      return true;
    }
    const previous = lastObservedTime.get(player) ?? -1;
    if (video.currentTime > previous + 0.01) {
      lastObservedTime.set(player, video.currentTime);
      return true;
    }
  }

  const hostTime = player.currentTime;
  if (
    typeof hostTime === "number" &&
    Number.isFinite(hostTime) &&
    hostTime > 0
  ) {
    const previous = lastObservedTime.get(player) ?? -1;
    if (hostTime > previous + 0.01) {
      lastObservedTime.set(player, hostTime);
      return true;
    }
  }

  return false;
}

export function resetMoviProgressObservation(player: MoviHostElement): void {
  lastObservedTime.delete(player);
}
