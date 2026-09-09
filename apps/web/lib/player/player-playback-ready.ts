export interface MoviHostElement extends HTMLElement {
  shadowRoot: ShadowRoot | null;
  currentTime?: number;
  paused?: boolean;
  playing?: boolean;
}

const HAVE_CURRENT_DATA = 2;

const moviVideoActivityScore = (video: HTMLVideoElement): number => {
  let score = 0;
  if (hasDecodedVideoFrame(video)) {
    score += 100;
  }
  if (!video.paused) {
    score += 40;
  }
  if (video.readyState >= HAVE_CURRENT_DATA) {
    score += 20;
  }
  if (video.currentTime > 0) {
    score += Math.min(video.currentTime, 30);
  }
  return score;
};

const collectMoviVideoCandidates = (
  player: MoviHostElement,
): HTMLVideoElement[] => {
  const seen = new Set<HTMLVideoElement>();
  const push = (node: Element | null | undefined) => {
    if (node instanceof HTMLVideoElement) {
      seen.add(node);
    }
  };

  push(player.querySelector(':scope > video[slot="media"]'));
  player.querySelectorAll(":scope > video").forEach((node) => push(node));
  player.shadowRoot?.querySelectorAll("video").forEach((node) => push(node));

  return [...seen];
};

export function getMoviVideoElement(
  player: MoviHostElement,
): HTMLVideoElement | null {
  const candidates = collectMoviVideoCandidates(player);
  if (candidates.length === 0) {
    return null;
  }
  if (candidates.length === 1) {
    return candidates[0] ?? null;
  }

  return candidates.reduce((best, candidate) =>
    moviVideoActivityScore(candidate) > moviVideoActivityScore(best)
      ? candidate
      : best,
  );
}

export function hasDecodedVideoFrame(video: HTMLVideoElement): boolean {
  return video.videoWidth > 0 && video.videoHeight > 0;
}

export function isMoviVideoPlaybackReady(video: HTMLVideoElement): boolean {
  return video.readyState >= HAVE_CURRENT_DATA && hasDecodedVideoFrame(video);
}

export function isScrapeVideoMakingProgress(
  container: ParentNode | null | undefined,
): boolean {
  const video = container?.querySelector(".nyumat-scrape-player video");
  if (!(video instanceof HTMLVideoElement)) {
    return false;
  }

  return (
    hasDecodedVideoFrame(video) ||
    (video.readyState >= HAVE_CURRENT_DATA && video.currentTime > 0) ||
    video.paused === false
  );
}

const lastObservedTime = new WeakMap<MoviHostElement, number>();

const hostClockIsAdvancing = (player: MoviHostElement): boolean => {
  if (player.playing !== true) {
    return false;
  }

  const candidates = collectMoviVideoCandidates(player);
  if (candidates.some(hasDecodedVideoFrame)) {
    return false;
  }

  const hostTime = player.currentTime;
  if (
    typeof hostTime !== "number" ||
    !Number.isFinite(hostTime) ||
    hostTime <= 0.25
  ) {
    return false;
  }

  const previous = lastObservedTime.get(player) ?? -1;
  if (hostTime > previous + 0.01) {
    lastObservedTime.set(player, hostTime);
    return true;
  }

  return true;
};

export function isMoviPlayerMakingProgress(player: MoviHostElement): boolean {
  const video = getMoviVideoElement(player);
  if (video) {
    if (hasDecodedVideoFrame(video)) {
      if (video.readyState >= HAVE_CURRENT_DATA && !video.paused) {
        lastObservedTime.set(player, video.currentTime);
        return true;
      }
      const previous = lastObservedTime.get(player) ?? -1;
      if (video.currentTime > previous + 0.01) {
        lastObservedTime.set(player, video.currentTime);
        return true;
      }
    }
  }

  if (hostClockIsAdvancing(player)) {
    return true;
  }

  return false;
}

export function resetMoviProgressObservation(player: MoviHostElement): void {
  lastObservedTime.delete(player);
}

export function isMoviHostPlaybackReady(player: MoviHostElement): boolean {
  const video = getMoviVideoElement(player);
  if (video) {
    if (isMoviVideoPlaybackReady(video)) {
      return true;
    }
    if (
      hasDecodedVideoFrame(video) &&
      !video.paused &&
      video.readyState >= HAVE_CURRENT_DATA
    ) {
      return true;
    }
  }

  if (player.playing === true && hostClockIsAdvancing(player)) {
    return true;
  }

  return isMoviPlayerMakingProgress(player);
}

const MOVI_READY_POLL_MS = 250;
const MOVI_VIDEO_READY_EVENTS = [
  "playing",
  "loadeddata",
  "loadedmetadata",
  "timeupdate",
  "resize",
] as const;
const MOVI_HOST_READY_EVENTS = ["loadeddata", "timeupdate", "statechange"] as const;

export function subscribeMoviPlaybackReady(
  player: MoviHostElement,
  onReady: () => void,
): () => void {
  let settled = false;
  let boundVideo: HTMLVideoElement | null = null;

  const bindVideo = (video: HTMLVideoElement | null) => {
    if (video === boundVideo) {
      return;
    }
    if (boundVideo) {
      for (const type of MOVI_VIDEO_READY_EVENTS) {
        boundVideo.removeEventListener(type, notify);
      }
    }
    boundVideo = video;
    if (!boundVideo) {
      return;
    }
    for (const type of MOVI_VIDEO_READY_EVENTS) {
      boundVideo.addEventListener(type, notify);
    }
  };

  const cleanup = () => {
    window.clearInterval(interval);
    bindVideo(null);
    for (const type of MOVI_HOST_READY_EVENTS) {
      player.removeEventListener(type, notify);
    }
  };

  const notify = () => {
    if (settled) {
      return;
    }
    bindVideo(getMoviVideoElement(player));
    if (!isMoviHostPlaybackReady(player)) {
      return;
    }
    settled = true;
    cleanup();
    onReady();
  };

  for (const type of MOVI_HOST_READY_EVENTS) {
    player.addEventListener(type, notify);
  }
  const interval = window.setInterval(notify, MOVI_READY_POLL_MS);
  notify();

  return () => {
    settled = true;
    cleanup();
  };
}
