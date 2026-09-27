"use client";

/**
 * Module-level state for the shared YouTube hover-preview iframe layer.
 *
 * Cards publish the currently hovered trailer (and its on-screen rect); a
 * single `<YouTubeHoverPreviewLayer>` rendered at the app root reacts by
 * positioning one reused `YT.Player` over that rect. Only one preview is ever
 * active because it piggybacks on `card-hover-preview-coordinator`.
 */

export type YouTubeHoverPreviewRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export type YouTubeHoverPreviewState = {
  id: string;
  youtubeKey: string;
  rect: YouTubeHoverPreviewRect;
  muted: boolean;
  /** True once the player has actually started rendering frames. */
  playing: boolean;
};

let state: YouTubeHoverPreviewState | null = null;
const listeners = new Set<(value: YouTubeHoverPreviewState | null) => void>();

const notify = () => {
  for (const listener of listeners) {
    listener(state);
  }
};

const rectsEqual = (
  a: YouTubeHoverPreviewRect,
  b: YouTubeHoverPreviewRect,
): boolean =>
  a.top === b.top &&
  a.left === b.left &&
  a.width === b.width &&
  a.height === b.height;

export const getYouTubeHoverPreview = (): YouTubeHoverPreviewState | null =>
  state;

export const subscribeYouTubeHoverPreview = (
  listener: (value: YouTubeHoverPreviewState | null) => void,
): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const showYouTubeHoverPreview = (
  value: YouTubeHoverPreviewState,
): void => {
  if (
    state &&
    state.id === value.id &&
    state.youtubeKey === value.youtubeKey &&
    state.muted === value.muted &&
    rectsEqual(state.rect, value.rect)
  ) {
    return;
  }
  // Preserve the live playback flag when the same trailer is re-published.
  const playing =
    state && state.id === value.id && state.youtubeKey === value.youtubeKey
      ? state.playing
      : value.playing;
  state = { ...value, playing };
  notify();
};

export const setYouTubeHoverPreviewPlaying = (
  id: string,
  playing: boolean,
): void => {
  if (!state || state.id !== id || state.playing === playing) {
    return;
  }
  state = { ...state, playing };
  notify();
};

export const updateYouTubeHoverPreviewRect = (
  id: string,
  rect: YouTubeHoverPreviewRect,
): void => {
  if (!state || state.id !== id || rectsEqual(state.rect, rect)) {
    return;
  }
  state = { ...state, rect };
  notify();
};

export const setYouTubeHoverPreviewMuted = (
  id: string,
  muted: boolean,
): void => {
  if (!state || state.id !== id || state.muted === muted) {
    return;
  }
  state = { ...state, muted };
  notify();
};

export const hideYouTubeHoverPreview = (id: string): void => {
  if (!state || state.id !== id) {
    return;
  }
  state = null;
  notify();
};
