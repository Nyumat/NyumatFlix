export const AMBIENT_GLOW_COOKIE = "nf-ambient-glow";
const AMBIENT_GLOW_STORAGE_KEY = "nyumatflix:ambient-glow";

export const parseAmbientGlow = (value: unknown): boolean | null => {
  if (value === true || value === "1" || value === "true") {
    return true;
  }
  if (value === false || value === "0" || value === "false") {
    return false;
  }
  return null;
};

export const readAmbientGlowFromCookieHeader = (
  header: string | null | undefined,
): boolean | null => {
  if (!header) {
    return null;
  }

  const parts = header.split(";");
  for (const part of parts) {
    const index = part.indexOf("=");
    if (index < 0) {
      continue;
    }
    const name = part.slice(0, index).trim();
    if (name !== AMBIENT_GLOW_COOKIE) {
      continue;
    }
    try {
      return parseAmbientGlow(decodeURIComponent(part.slice(index + 1).trim()));
    } catch {
      return null;
    }
  }

  return null;
};

/** Client-only: cheapest synchronous read (dataset first, set by blocking script). */
export const readAmbientGlowClient = (): boolean | null => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }

  const fromDataset = parseAmbientGlow(
    document.documentElement.dataset.ambientGlow,
  );
  if (fromDataset !== null) {
    return fromDataset;
  }

  try {
    const match = document.cookie.match(/(?:^|;\s*)nf-ambient-glow=([^;]*)/);
    const fromCookie = parseAmbientGlow(
      match?.[1] ? decodeURIComponent(match[1]) : null,
    );
    if (fromCookie !== null) {
      return fromCookie;
    }
  } catch {
    // Ignore cookie access errors (e.g. blocked cookies).
  }

  try {
    const stored = window.localStorage.getItem(AMBIENT_GLOW_STORAGE_KEY);
    const fromStorage = parseAmbientGlow(stored);
    if (fromStorage !== null) {
      return fromStorage;
    }
  } catch {
    // Ignore storage access errors (e.g. private mode).
  }

  return null;
};

/**
 * Client-only: synchronously persist ambient glow so the next paint and the
 * next hard load (blocking script) already match. Safe to call inside zustand
 * actions — runs before the next paint.
 */
export const persistAmbientGlowClient = (enabled: boolean): void => {
  if (typeof document === "undefined") {
    return;
  }

  const value = enabled ? "1" : "0";

  try {
    document.documentElement.dataset.ambientGlow = value;
  } catch {
    // Ignore DOM errors.
  }

  try {
    document.cookie = `${AMBIENT_GLOW_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Lax`;
  } catch {
    // Ignore cookie errors.
  }

  try {
    window.localStorage.setItem(AMBIENT_GLOW_STORAGE_KEY, value);
  } catch {
    // Ignore storage errors.
  }
};
