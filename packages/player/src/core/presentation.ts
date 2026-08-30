import type { PlayerConfig, SourceConfig } from "../types";

export type PresentationMode = "native" | "canvas";

const ADAPTIVE_RE = /\.(m3u8|mpd|ism|isml)(\?|#|$)/i;
const PROGRESSIVE_NATIVE_RE = /\.(mp4|webm|m4v|mov)(\?|#|$)/i;

export function isAdaptiveStreamUrl(url: string): boolean {
  return ADAPTIVE_RE.test(url);
}

export function isProgressiveNativeUrl(url: string): boolean {
  return PROGRESSIVE_NATIVE_RE.test(url);
}

export function isSafariBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR/i.test(ua);
}

export function isFirefoxBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Firefox/i.test(navigator.userAgent);
}

export function castSupported(): boolean {
  if (typeof window === "undefined") return false;
  if (isFirefoxBrowser()) return false;
  return !!(window as Window & { chrome?: { cast?: unknown } }).chrome?.cast;
}

export function airPlaySupported(video?: HTMLVideoElement): boolean {
  if (typeof video === "undefined") return false;
  return typeof (video as HTMLVideoElement & { webkitShowPlaybackTargetPicker?: unknown })
    .webkitShowPlaybackTargetPicker === "function";
}

export function remotePlaybackSupported(video?: HTMLVideoElement): boolean {
  if (typeof video === "undefined") return false;
  return typeof (video as HTMLVideoElement & { remote?: RemotePlayback }).remote !== "undefined";
}

export function shouldPreferNativeHls(url: string): boolean {
  return isSafariBrowser() && url.toLowerCase().includes(".m3u8");
}

export function shouldPreferHlsJs(url: string): boolean {
  return isFirefoxBrowser() && url.toLowerCase().includes(".m3u8");
}

export function sourceUrl(config: Pick<PlayerConfig, "source">): string | null {
  const src = config.source;
  if (!src || src.type !== "url" || !src.url) return null;
  return src.url;
}

export function resolvePresentationMode(
  config: Pick<
    PlayerConfig,
    "source" | "presentation" | "renderer" | "drm" | "lcevc" | "sourceAdapter"
  >,
): PresentationMode {
  if (config.presentation === "canvas") return "canvas";
  if (config.presentation === "native") return "native";
  if (config.lcevc) return "canvas";

  if (config.sourceAdapter) return "canvas";

  const url = sourceUrl(config);
  if (url) {
    if (config.drm || isAdaptiveStreamUrl(url) || isProgressiveNativeUrl(url)) {
      return "native";
    }
  }

  if (config.source?.type === "file") return "canvas";
  if (config.source?.type === "encrypted") return "native";

  return "canvas";
}

export function usesCanvasCopyLoop(config: PlayerConfig): boolean {
  if (config.presentation === "native") return false;
  if (config.lcevc) return false;
  if (config.drm) return false;
  return !!(config.canvas && (config.renderer === "canvas" || !config.renderer));
}

export function applyStreamVideoVisibility(
  video: HTMLVideoElement,
  config: PlayerConfig,
): void {
  if (usesCanvasCopyLoop(config)) {
    video.style.display = "none";
    return;
  }
  video.style.display = "block";
  video.style.width = "100%";
  video.style.height = "100%";
  if (!video.style.objectFit) {
    video.style.objectFit = "contain";
  }
}

export function inferPresentationFromSource(
  source: SourceConfig | undefined,
  presentationOverride?: PresentationMode,
): PresentationMode {
  return resolvePresentationMode({
    source,
    presentation: presentationOverride,
    drm: false,
  });
}
