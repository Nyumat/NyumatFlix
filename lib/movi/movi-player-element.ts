import { resolveMoviMediaUrl } from "@/lib/movi/load-movi-player";

export interface MoviPlayerElement extends HTMLElement {
  src?: string;
  poster?: string;
  controls?: boolean;
  autoplay?: boolean;
  muted?: boolean;
  volume?: number;
  playsinline?: boolean;
  theme?: string;
  currentTime: number;
  duration: number;
  ended: boolean;
  playing?: boolean;
  play?: () => Promise<void>;
  getAudioLangs?: () => Array<{ lang: string; label: string; active: boolean }>;
  selectAudioLang?: (lang: string) => boolean;
  getSubtitleLangs?: () => Array<{
    lang: string;
    label: string;
    active: boolean;
  }>;
  selectSubtitleLang?: (lang: string | null) => Promise<boolean>;
}

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

export function applyMoviSource(
  el: MoviPlayerElement,
  src: string,
  poster?: string | null,
  title?: string,
): void {
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
  el.setAttribute("buffersize", "512");
  const play = (el as MoviPlayerElement & { play?: () => Promise<void> }).play;
  if (typeof play === "function") {
    void play.call(el).catch(() => undefined);
  }
}

export function disposeMoviPlayer(el: MoviPlayerElement | null): void {
  if (!el) {
    return;
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
