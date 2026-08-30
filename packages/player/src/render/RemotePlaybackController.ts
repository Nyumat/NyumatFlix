import { castSupported } from "../core/presentation";
import { Logger } from "../utils/Logger";

const TAG = "RemotePlaybackController";

type CastSession = {
  loadMedia: (
    request: { media: { contentId: string; contentType: string; streamType: string } },
    success: () => void,
    error: (err: unknown) => void,
  ) => void;
};

type CastApi = {
  initialize: (
    apiConfig: { receiverApplicationId: string; autoJoinPolicy: string },
    onSuccess: () => void,
    onError: (err: unknown) => void,
  ) => void;
  requestSession: (
    onSuccess: (session: CastSession) => void,
    onError: (err: unknown) => void,
  ) => void;
};

declare global {
  interface Window {
    __moviCastInitialized?: boolean;
    cast?: {
      framework?: {
        CastContext?: {
          getInstance: () => {
            setOptions: (opts: {
              receiverApplicationId: string;
              autoJoinPolicy: string;
            }) => void;
            requestSession: () => Promise<unknown>;
          };
        };
      };
    };
    chrome?: {
      cast?: {
        media?: { DEFAULT_MEDIA_RECEIVER_APP_ID: string };
        AutoJoinPolicy?: { ORIGIN_SCOPED: string };
        isAvailable?: boolean;
        initialize: CastApi["initialize"];
        requestSession: CastApi["requestSession"];
      };
    };
  }
}

export interface RemotePlaybackOptions {
  video: HTMLVideoElement;
  getSourceUrl: () => string | null;
  getContentType: () => string;
  onCanCastChange?: (canCast: boolean) => void;
}

export class RemotePlaybackController {
  private options: RemotePlaybackOptions;
  private castReady = false;

  constructor(options: RemotePlaybackOptions) {
    this.options = options;
  }

  get canCast(): boolean {
    return castSupported();
  }

  get canAirPlay(): boolean {
    const v = this.options.video as HTMLVideoElement & {
      webkitShowPlaybackTargetPicker?: unknown;
    };
    return typeof v.webkitShowPlaybackTargetPicker === "function";
  }

  get canRemotePlayback(): boolean {
    return typeof this.options.video.remote !== "undefined";
  }

  notifyCapability(): void {
    this.options.onCanCastChange?.(this.canCast);
  }

  showAirPlayPicker(): void {
    const v = this.options.video as HTMLVideoElement & {
      webkitShowPlaybackTargetPicker?: () => void;
    };
    v.webkitShowPlaybackTargetPicker?.();
  }

  async requestCast(): Promise<void> {
    if (!this.canCast) {
      throw new Error("Cast is not supported in this browser");
    }
    const url = this.options.getSourceUrl();
    if (!url) {
      throw new Error("No castable source URL");
    }

    await this.ensureCastApi();
    const chromeCast = window.chrome?.cast;
    if (!chromeCast?.requestSession) {
      throw new Error("Cast API unavailable");
    }

    return new Promise<void>((resolve, reject) => {
      chromeCast.requestSession!(
        (session) => {
          const media = chromeCast.media;
          if (!media || !session.loadMedia) {
            reject(new Error("Cast media API unavailable"));
            return;
          }
          session.loadMedia(
            {
              media: {
                contentId: url,
                contentType: this.options.getContentType(),
                streamType: "BUFFERED",
              },
            },
            () => resolve(),
            (err) => reject(err instanceof Error ? err : new Error(String(err))),
          );
        },
        (err) => reject(err instanceof Error ? err : new Error(String(err))),
      );
    });
  }

  private async ensureCastApi(): Promise<void> {
    if (this.castReady) return;
    if (window.__moviCastInitialized) {
      this.castReady = true;
      return;
    }

    await this.loadCastFramework();
    const chromeCast = window.chrome?.cast;
    if (!chromeCast?.initialize) {
      throw new Error("Cast framework failed to load");
    }

    return new Promise<void>((resolve, reject) => {
      const appId =
        chromeCast.media?.DEFAULT_MEDIA_RECEIVER_APP_ID ?? "CC1AD845";
      const policy =
        chromeCast.AutoJoinPolicy?.ORIGIN_SCOPED ?? "origin_scoped";
      chromeCast.initialize(
        { receiverApplicationId: appId, autoJoinPolicy: policy },
        () => {
          window.__moviCastInitialized = true;
          this.castReady = true;
          resolve();
        },
        (err) => {
          Logger.warn(TAG, "Cast initialize failed", err);
          reject(err instanceof Error ? err : new Error(String(err)));
        },
      );
    });
  }

  private loadCastFramework(): Promise<void> {
    if (document.querySelector('script[data-movi-cast="true"]')) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src =
        "https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1";
      script.async = true;
      script.dataset.moviCast = "true";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Cast sender SDK"));
      document.head.appendChild(script);
    });
  }
}
