"use client";

/**
 * Lazy singleton loader for the YouTube IFrame API, shared by the card hover
 * preview layer. The media detail hero injects the same script tag directly;
 * `window.YT?.Player` short-circuits when it is already present.
 */

export type YouTubePlayerVars = {
  autoplay?: number;
  controls?: number;
  rel?: number;
  fs?: number;
  iv_load_policy?: number;
  modestbranding?: number;
  playsinline?: number;
  loop?: number;
  playlist?: string;
  disablekb?: number;
  mute?: number;
};

export type YouTubePlayerInstance = {
  destroy: () => void;
  playVideo?: () => void;
  pauseVideo?: () => void;
  mute?: () => void;
  unMute?: () => void;
  setVolume?: (volume: number) => void;
  loadVideoById?: (videoId: string) => void;
  cueVideoById?: (videoId: string) => void;
  getPlayerState?: () => number;
  getIframe?: () => HTMLElement | null;
};

export type YouTubeApi = {
  Player: new (
    element: HTMLElement | string,
    options: {
      videoId?: string;
      width?: string | number;
      height?: string | number;
      playerVars?: YouTubePlayerVars;
      events?: {
        onReady?: (event: { target: YouTubePlayerInstance }) => void;
        onStateChange?: (event: {
          data: number;
          target: YouTubePlayerInstance;
        }) => void;
        onError?: (event: unknown) => void;
      };
    },
  ) => YouTubePlayerInstance;
  PlayerState?: {
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
    BUFFERING: number;
    CUED: number;
  };
};

let apiPromise: Promise<YouTubeApi | null> | null = null;

export const loadYouTubeIframeApi = (): Promise<YouTubeApi | null> => {
  if (typeof window === "undefined") {
    return Promise.resolve(null);
  }

  const existing = (window as unknown as { YT?: YouTubeApi }).YT;
  if (existing?.Player) {
    return Promise.resolve(existing);
  }

  if (apiPromise) {
    return apiPromise;
  }

  apiPromise = new Promise<YouTubeApi | null>((resolve) => {
    const win = window as unknown as {
      YT?: YouTubeApi;
      onYouTubeIframeAPIReady?: () => void;
    };
    const previousReady = win.onYouTubeIframeAPIReady;

    win.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      resolve(win.YT ?? null);
    };

    const alreadyRequested = document.querySelector(
      'script[src*="youtube.com/iframe_api"]',
    );
    if (alreadyRequested) {
      return;
    }

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    tag.async = true;
    document.head.appendChild(tag);
  });

  return apiPromise;
};
