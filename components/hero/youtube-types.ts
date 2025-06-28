// Declare YouTube API types
declare global {
  interface Window {
    YT: {
      Player: new (
        elementId: string,
        options: {
          videoId: string;
          playerVars?: {
            autoplay?: number;
            controls?: number;
            rel?: number;
          };
          events?: {
            onStateChange?: (event: { data: number }) => void;
            onReady?: (event: { target: unknown }) => void;
          };
        },
      ) => {
        destroy: () => void;
        getPlayerState?: () => number;
      };
    };
    onYouTubeIframeAPIReady: () => void;
  }
}

// Type for YouTube Player
export type YouTubePlayer = {
  destroy: () => void;
  getPlayerState?: () => number;
} | null;
