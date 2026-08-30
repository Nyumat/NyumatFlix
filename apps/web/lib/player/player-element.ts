import { resolveMoviMediaUrl } from "@/lib/player/load-player";
import type { MoviHostElement } from "@/lib/player/player-playback-ready";

export interface MoviPlayerElement extends MoviHostElement {
  src?: string;
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

export function applyMoviSource(
  el: MoviPlayerElement,
  src: string,
  poster?: string | null,
  title?: string,
  streamLabel?: string,
): void {
  clearMoviResumeKeys(title, streamLabel);

  el.setAttribute("startat", "0");
  el.setAttribute("noerrorscreen", "");
  el.removeAttribute("resume");

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

  try {
    el.dispose?.();
  } catch {
    // movi-player may already be torn down.
  }

  try {
    el.removeAttribute("src");
  } catch {
    // WASM demuxer may already be torn down.
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
