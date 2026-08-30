/** player integration: load element.js as an ES module script (never webpack-bundle it). */
import { PLAYER_ASSET_VERSION } from "@/lib/player/player-asset.generated";

export const PLAYER_SCRIPT = `/vendor/player/element.js?v=${PLAYER_ASSET_VERSION}`;
export const MOVI_PLAYER_SCRIPT = PLAYER_SCRIPT;
export const MOVI_PLAYER_COMPAT_SCRIPT = `/vendor/player/compat.js?v=${PLAYER_ASSET_VERSION}`;

const PLAYER_VERSION_STORAGE_KEY = "movi-player-asset-version";

let loadPromise: Promise<void> | null = null;
let compatLoadPromise: Promise<void> | null = null;
let fullScriptRequested = false;
let injectionMutex: Promise<void> = Promise.resolve();
let loaded = false;
let compatLoaded = false;
const loadedListeners = new Set<() => void>();
const compatLoadedListeners = new Set<() => void>();

function isMoviPlayerRegistered(): boolean {
  return (
    typeof customElements !== "undefined" && !!customElements.get("movi-player")
  );
}

function resetPlayerLoadState(): void {
  loadPromise = null;
  compatLoadPromise = null;
  loaded = false;
  compatLoaded = false;
}

function removePlayerScripts(): void {
  document
    .querySelectorAll(
      'script[data-player="full"], script[data-player="compat"]',
    )
    .forEach((node) => node.remove());
}

function ensureFreshPlayerAssetVersion(): void {
  if (typeof window === "undefined") {
    return;
  }

  const previousVersion = sessionStorage.getItem(PLAYER_VERSION_STORAGE_KEY);
  if (
    previousVersion &&
    previousVersion !== PLAYER_ASSET_VERSION &&
    isMoviPlayerRegistered()
  ) {
    sessionStorage.setItem(PLAYER_VERSION_STORAGE_KEY, PLAYER_ASSET_VERSION);
    window.location.reload();
    return;
  }

  sessionStorage.setItem(PLAYER_VERSION_STORAGE_KEY, PLAYER_ASSET_VERSION);
}

function markMoviPlayerLoaded(): void {
  if (loaded) {
    return;
  }
  loaded = true;
  compatLoaded = true;
  for (const listener of [...loadedListeners]) {
    listener();
  }
  for (const listener of [...compatLoadedListeners]) {
    listener();
  }
}

function markMoviCompatLoaded(): void {
  if (compatLoaded) {
    return;
  }
  compatLoaded = true;
  for (const listener of [...compatLoadedListeners]) {
    listener();
  }
}

export function isMoviPlayerLoaded(): boolean {
  if (!loaded && isMoviPlayerRegistered()) {
    loaded = true;
  }
  return loaded;
}

export function isMoviCompatLoaded(): boolean {
  if (!compatLoaded && isMoviPlayerRegistered()) {
    compatLoaded = true;
  }
  return compatLoaded;
}

export function subscribeMoviPlayerLoaded(listener: () => void): () => void {
  loadedListeners.add(listener);
  return () => {
    loadedListeners.delete(listener);
  };
}

export function subscribeMoviCompatLoaded(listener: () => void): () => void {
  compatLoadedListeners.add(listener);
  return () => {
    compatLoadedListeners.delete(listener);
  };
}

function withInjectionLock<T>(task: () => Promise<T>): Promise<T> {
  const run = injectionMutex.then(task, task);
  injectionMutex = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function injectPlayerScript(src: string, datasetKey: string): Promise<void> {
  return withInjectionLock(async () => {
    if (isMoviPlayerRegistered()) {
      return;
    }

    const expectedSrc = new URL(src, window.location.origin).href;
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-player="${datasetKey}"]`,
    );
    if (existing) {
      const sameAsset =
        existing.src === expectedSrc &&
        existing.dataset.playerVersion === PLAYER_ASSET_VERSION;
      if (sameAsset) {
        if (existing.dataset.loaded === "true") {
          return;
        }
        await new Promise<void>((resolve, reject) => {
          existing.addEventListener("load", () => resolve(), { once: true });
          existing.addEventListener(
            "error",
            () => reject(new Error(`Failed to load ${src}`)),
            { once: true },
          );
        });
        return;
      }
      if (!isMoviPlayerRegistered()) {
        existing.remove();
      }
    }

    if (isMoviPlayerRegistered()) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.type = "module";
      script.src = src;
      script.dataset.player = datasetKey;
      script.dataset.playerVersion = PLAYER_ASSET_VERSION;
      script.addEventListener(
        "load",
        () => {
          script.dataset.loaded = "true";
          resolve();
        },
        { once: true },
      );
      script.addEventListener(
        "error",
        () => reject(new Error(`Failed to load ${src}`)),
        { once: true },
      );
      document.head.appendChild(script);
    });
  });
}

export function loadMoviCompat(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }
  ensureFreshPlayerAssetVersion();
  if (fullScriptRequested || loadPromise) {
    return loadMoviPlayer();
  }
  if (isMoviPlayerRegistered()) {
    markMoviCompatLoaded();
    return Promise.resolve();
  }
  if (!compatLoadPromise) {
    compatLoadPromise = injectPlayerScript(MOVI_PLAYER_COMPAT_SCRIPT, "compat")
      .then(() => {
        markMoviCompatLoaded();
      })
      .catch((error) => {
        compatLoadPromise = null;
        throw error;
      });
  }
  return compatLoadPromise;
}

export function loadMoviFull(): Promise<void> {
  return loadMoviPlayer();
}

export function loadMoviPlayer(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }
  fullScriptRequested = true;
  ensureFreshPlayerAssetVersion();
  if (isMoviPlayerRegistered()) {
    markMoviPlayerLoaded();
    return Promise.resolve();
  }
  if (!loadPromise) {
    loadPromise = injectPlayerScript(PLAYER_SCRIPT, "full")
      .then(() => {
        markMoviPlayerLoaded();
      })
      .catch((error) => {
        loadPromise = null;
        removePlayerScripts();
        resetPlayerLoadState();
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

export function invalidateMoviPlayerCache(): void {
  removePlayerScripts();
  resetPlayerLoadState();
  fullScriptRequested = false;
  injectionMutex = Promise.resolve();
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(PLAYER_VERSION_STORAGE_KEY);
  }
}
