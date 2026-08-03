/** movi-player official integration: load element.js as an ES module script (never webpack-bundle it). */
export const MOVI_PLAYER_SCRIPT = "/vendor/movi-player/element.js";

let loadPromise: Promise<void> | null = null;

function isMoviPlayerRegistered(): boolean {
  return (
    typeof customElements !== "undefined" && !!customElements.get("movi-player")
  );
}

function injectMoviPlayerScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-movi-player="true"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Failed to load movi-player")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.type = "module";
    script.src = MOVI_PLAYER_SCRIPT;
    script.dataset.moviPlayer = "true";
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error(`Failed to load ${MOVI_PLAYER_SCRIPT}`)),
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
    return Promise.resolve();
  }
  if (!loadPromise) {
    loadPromise = injectMoviPlayerScript().catch((error) => {
      loadPromise = null;
      throw error;
    });
  }
  return loadPromise;
}

export function resolveMoviMediaUrl(src: string): string {
  if (src.startsWith("http://") || src.startsWith("https://")) {
    return src;
  }
  return `${window.location.origin}${src.startsWith("/") ? src : `/${src}`}`;
}
