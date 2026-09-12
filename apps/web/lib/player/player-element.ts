import { resolveMoviMediaUrl } from "@/lib/player/load-player";
import type { MoviHostElement } from "@/lib/player/player-playback-ready";

export interface MoviPlayerElement extends MoviHostElement {
  src?: string | null;
  poster?: string;
  controls?: boolean;
  autoplay?: boolean;
  muted?: boolean;
  volume?: number;
  playsinline?: boolean;
  theme?: string;
  presentation?: PresentationMode;
  currentTime: number;
  duration: number;
  ended: boolean;
  paused: boolean;
  playing?: boolean;
  play?: () => Promise<void>;
  headers?: Record<string, string> | null;
  hlsConfig?: {
    enableWorker?: boolean;
    lowLatencyMode?: boolean;
    startPosition?: number;
    maxBufferLength?: number;
    maxMaxBufferLength?: number;
    maxBufferHole?: number;
    maxStarvationDelay?: number;
    nudgeOffset?: number;
    nudgeMaxRetry?: number;
    highBufferWatchdogPeriod?: number;
    fragLoadingTimeOut?: number;
    fragLoadingMaxRetry?: number;
    levelLoadingMaxRetry?: number;
    manifestLoadingMaxRetry?: number;
    backBufferLength?: number;
  } | null;
  source?:
    | ((
        value?:
          | string
          | { src: string; type?: string }
          | Array<{ src: string; type?: string }>
          | {
              video: { src: string; type?: string };
              audio?:
                | { src: string; type?: string }
                | Array<{
                    src: string;
                    type?: string;
                    lang: string;
                    label: string;
                  }>;
              subtitles?: Array<{
                src: string;
                lang: string;
                label: string;
                format?: string;
              }>;
            },
      ) => {
        src: string | File | null;
        type: string;
        audioSrc?: string | null;
      } | void)
    | string
    | File
    | {
        video: { src: string; type?: string };
        audio?:
          | { src: string; type?: string }
          | Array<{ src: string; type?: string }>;
        subtitles?: Array<{
          src: string;
          lang: string;
          label: string;
          format?: string;
        }>;
      }
    | Array<{ src: string; type?: string }>
    | null;
  getAudioLangs?: () => Array<{ lang: string; label: string; active: boolean }>;
  selectAudioLang?: (lang: string) => boolean;
  getSubtitleLangs?: () => Array<{
    id: string;
    lang: string;
    label: string;
    active: boolean;
  }>;
  getSubtitleTracks?: () => Array<{
    id: number;
    language?: string;
    label?: string;
  }>;
  selectExternalSubtitle?: (id: string | null) => Promise<boolean>;
  selectSubtitleLang?: (lang: string | null) => Promise<boolean>;
  selectSubtitleTrack?: (trackId: number | null) => Promise<boolean>;
  getActiveSubtitlePreference?: () => string;
  setExternalQualities?: (qualities: ExternalQualityEntry[]) => void;
  getExternalQualities?: () => ExternalQualityEntry[];
  setChapterMarkers?: (chapters: ChapterMarker[]) => void;
  getChapterMarkers?: () => ChapterMarker[];
  getPresentationMode?: () => PresentationMode;
  canCast?: () => boolean;
  dispose?: () => void;
  setExternalSubtitles?: (
    subtitles: Array<{
      id?: string;
      src: string;
      lang: string;
      label: string;
      format?: string;
      default?: boolean;
    }>,
  ) => void;
}

export type PresentationMode = "native" | "canvas";

export type ExternalQualityEntry = {
  label: string;
  url: string;
  height?: number;
  type?: string;
};

export type ChapterMarker = {
  title: string;
  start: number;
  end?: number;
};

export function resolveMoviPosterUrl(
  poster: string | null | undefined,
): string | undefined {
  if (!poster) return undefined;
  try {
    const url = new URL(poster, window.location.origin);
    if (url.origin === window.location.origin) return url.toString();
  } catch {
    return undefined;
  }
  return undefined;
}

const clearMoviResumeForTitle = (title: string | undefined): void => {
  const trimmed = title?.trim();
  if (!trimmed) return;
  try {
    localStorage.removeItem(`movi-resume:${trimmed}`);
  } catch {
    // storage may be unavailable
  }
};

export const clearMoviResumeKeys = (
  title: string | undefined,
  streamLabel: string | undefined,
): void => {
  clearMoviResumeForTitle(title);
  clearMoviResumeForTitle(streamLabel);
};

const MOVI_HOST_OVERLAY_SELECTORS = [
  ".movi-empty-state",
  ".movi-broken-indicator",
  ".movi-resume-dialog",
  ".movi-error-indicator",
] as const;

export const suppressMoviHostOverlays = (el: MoviPlayerElement): void => {
  const shadow = el.shadowRoot;
  if (!shadow) {
    return;
  }

  for (const selector of MOVI_HOST_OVERLAY_SELECTORS) {
    const node = shadow.querySelector(selector);
    if (!(node instanceof HTMLElement)) {
      continue;
    }
    if (node.style.display !== "none") {
      node.style.display = "none";
    }
    if (node.getAttribute("aria-hidden") !== "true") {
      node.setAttribute("aria-hidden", "true");
    }
  }
};

export const attachMoviHostOverlaySuppressor = (
  el: MoviPlayerElement,
): (() => void) => {
  const shadow = el.shadowRoot;
  if (!shadow) {
    suppressMoviHostOverlays(el);
    return () => undefined;
  }

  let rafId = 0;
  const scheduleSuppress = () => {
    if (rafId !== 0) {
      return;
    }
    rafId = window.requestAnimationFrame(() => {
      rafId = 0;
      suppressMoviHostOverlays(el);
    });
  };

  suppressMoviHostOverlays(el);

  const observer = new MutationObserver(scheduleSuppress);
  observer.observe(shadow, {
    childList: true,
    subtree: true,
  });

  return () => {
    observer.disconnect();
    if (rafId !== 0) {
      window.cancelAnimationFrame(rafId);
    }
  };
};

export const configureMoviScrapePlayback = (
  el: MoviPlayerElement,
  options: {
    title?: string;
    startAt: number;
    streamLabel?: string;
  },
): void => {
  clearMoviResumeKeys(options.title, options.streamLabel);
  el.removeAttribute("resume");
  el.setAttribute("startat", String(options.startAt));
  el.setAttribute("noerrorscreen", "");
  if (options.title) {
    el.setAttribute("title", options.title);
  } else {
    el.removeAttribute("title");
  }
  suppressMoviHostOverlays(el);
};

export function applyMoviSource(
  el: MoviPlayerElement,
  src: string,
  poster?: string | null,
  title?: string,
  streamLabel?: string,
): void {
  configureMoviScrapePlayback(el, { title, startAt: 0, streamLabel });

  el.src = resolveMoviMediaUrl(src);
  const posterUrl = resolveMoviPosterUrl(poster);
  if (posterUrl) el.poster = posterUrl;
  else el.removeAttribute("poster");
  if (title) el.setAttribute("title", title);
  else el.removeAttribute("title");
  el.controls = true;
  el.autoplay = true;
  el.muted = false;
  el.volume = 1;
  el.playsinline = true;
  el.theme = "dark";
  el.setAttribute("fastseek", "");
  el.setAttribute("buffersize", "256");
  const play = el.play;
  if (typeof play === "function") {
    void play.call(el).catch(() => undefined);
  }
}

export function disposeMoviPlayer(el: MoviPlayerElement | null): void {
  if (!el) {
    return;
  }

  suppressMoviHostOverlays(el);

  try {
    el.removeAttribute("resume");
  } catch {
    // movi-player may already be torn down.
  }

  try {
    const pause = (el as MoviPlayerElement & { pause?: () => void }).pause;
    if (typeof pause === "function") {
      pause.call(el);
    }
  } catch {
    // movi-player may already be torn down.
  }

  try {
    el.dispose?.();
  } catch {
    // movi-player may already be torn down.
  }

  try {
    el.src = null;
  } catch {
    // WASM demuxer may already be torn down.
  }

  try {
    el.hlsConfig = null;
    el.headers = null;
  } catch {
    // movi-player may already be torn down.
  }

  try {
    if (el.isConnected) {
      el.remove();
    }
  } catch {
    // movi-player WASM can throw during remove().
  }
}

export function isMoviWasmError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("memory access out of bounds") ||
    lower.includes("runtimeerror") ||
    lower.includes("wasm") ||
    lower.includes("movi")
  );
}
