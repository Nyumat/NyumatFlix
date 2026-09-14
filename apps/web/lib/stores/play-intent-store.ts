import { create } from "zustand";

const SESSION_KEY = "nyumatflix:play-intent:v1";

export type PlayIntentTarget =
  | { kind: "movie"; href: string }
  | { kind: "tv"; href: string; eligible: boolean };

type PlayIntentState = {
  target: PlayIntentTarget | null;
  requestPlay: (target: PlayIntentTarget) => void;
  consumePlay: (href: string) => boolean;
};

const readSessionIntent = (): PlayIntentTarget | null => {
  if (typeof window === "undefined" || typeof sessionStorage === "undefined") {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PlayIntentTarget | null;
    if (!parsed || typeof parsed.href !== "string") return null;
    if (parsed.kind !== "movie" && parsed.kind !== "tv") return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeSessionIntent = (target: PlayIntentTarget | null) => {
  if (typeof window === "undefined" || typeof sessionStorage === "undefined") {
    return;
  }
  try {
    if (!target) {
      sessionStorage.removeItem(SESSION_KEY);
      return;
    }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(target));
  } catch {
    // sessionStorage unavailable (private mode quota) — memory store still works.
  }
};

export const usePlayIntentStore = create<PlayIntentState>()((set, get) => ({
  target: typeof window !== "undefined" ? readSessionIntent() : null,
  requestPlay: (target) => {
    writeSessionIntent(target);
    set({ target });
  },
  consumePlay: (href) => {
    const { target } = get();
    const pending = target ?? readSessionIntent();
    if (!pending || pending.href !== href) return false;
    writeSessionIntent(null);
    if (target) set({ target: null });
    return true;
  },
}));

/** Read without subscribing — for navigation-time checks. */
export const readPlayIntent = (): PlayIntentTarget | null =>
  usePlayIntentStore.getState().target ?? readSessionIntent();
