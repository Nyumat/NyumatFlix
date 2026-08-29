/** player integration: load element.js as an ES module script (never webpack-bundle it). */
import { PLAYER_ASSET_VERSION } from "@/lib/player/player-asset.generated";

export const PLAYER_SCRIPT = `/vendor/player/element.js?v=${PLAYER_ASSET_VERSION}`;
export const MOVI_PLAYER_SCRIPT = PLAYER_SCRIPT;

let loadPromise: Promise<void> | null = null;
let loaded = false;
const loadedListeners = new Set<() => void>();

function isMoviPlayerRegistered(): boolean {
  return (
    typeof customElements !== "undefined" && !!customElements.get("movi-player")
  );
}

function markMoviPlayerLoaded(): void {
  if (loaded) {
    return;
  }
  loaded = true;
  for (const listener of [...loadedListeners]) {
    listener();
  }
}

export function isMoviPlayerLoaded(): boolean {
  if (!loaded && isMoviPlayerRegistered()) {
    loaded = true;
  }
  return loaded;
}

export function subscribeMoviPlayerLoaded(listener: () => void): () => void {
  loadedListeners.add(listener);
  return () => {
    loadedListeners.delete(listener);
  };
}

function injectPlayerScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-player="true"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Failed to load player")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.type = "module";
    script.src = PLAYER_SCRIPT;
    script.dataset.player = "true";
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error(`Failed to load ${PLAYER_SCRIPT}`)),
      { once: true },
    );
    document.head.appendChild(script);
  });
}

export function loadMoviPlayer(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }
  if (isMoviPlayerRegistered()) {
    markMoviPlayerLoaded();
    return Promise.resolve();
  }
  if (!loadPromise) {
    loadPromise = injectPlayerScript()
      .then(() => {
        markMoviPlayerLoaded();
      })
      .catch((error) => {
        loadPromise = null;
        throw error;
      });
  }
  return loadPromise;
}

export const loadPlayer = loadMoviPlayer;

export function resolveMoviMediaUrl(src: string): string {
  if (src.startsWith("http://") || src.startsWith("https://")) {
    return src;
  }
  return `${window.location.origin}${src.startsWith("/") ? src : `/${src}`}`;
}

export const resolvePlayerMediaUrl = resolveMoviMediaUrl;
