export type YouTubeIframePlayerVars = {
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
};

export const HERO_YOUTUBE_CHROMELESS_BASE: YouTubeIframePlayerVars = {
  controls: 0,
  disablekb: 1,
  fs: 0,
  iv_load_policy: 3,
  rel: 0,
  modestbranding: 1,
  playsinline: 1,
};

declare global {
  interface Window {
    YT: {
      Player: new (
        elementId: string,
        options: {
          videoId: string;
          playerVars?: YouTubeIframePlayerVars;
          events?: {
            onStateChange?: (event: { data: number }) => void;
            onReady?: (event: { target: unknown }) => void;
          };
        },
      ) => {
        destroy: () => void;
        getPlayerState?: () => number;
        mute?: () => void;
        playVideo?: () => void;
      };
    };
    onYouTubeIframeAPIReady: () => void;
  }
}

export type YouTubePlayer = {
  destroy: () => void;
  getPlayerState?: () => number;
  mute?: () => void;
  playVideo?: () => void;
} | null;
