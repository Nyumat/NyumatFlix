import type { CatalogCardStyle } from "@/lib/user/user-settings-types";

export const CATALOG_CARD_STYLE_COOKIE = "nf-catalog-card-style";
const CATALOG_CARD_STYLE_STORAGE_KEY = "nyumatflix:catalog-card-style";

export const parseCatalogCardStyle = (
  value: unknown,
): CatalogCardStyle | null =>
  value === "poster" || value === "backdrop" ? value : null;

/** Cookie wins over the experience default. localStorage is client-only. */
export const resolveCatalogCardStyleSnapshot = (
  cookieValue: string | undefined,
  fallback: CatalogCardStyle,
): CatalogCardStyle => parseCatalogCardStyle(cookieValue) ?? fallback;

export const readCatalogCardStyleFromCookieHeader = (
  header: string | null | undefined,
): CatalogCardStyle | null => {
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
    if (name !== CATALOG_CARD_STYLE_COOKIE) {
      continue;
    }
    try {
      return parseCatalogCardStyle(
        decodeURIComponent(part.slice(index + 1).trim()),
      );
    } catch {
      return null;
    }
  }

  return null;
};

/** Client-only cookie read, skipping the dataset the blocking script may have set. */
export const readCatalogCardStyleFromDocumentCookie =
  (): CatalogCardStyle | null => {
    if (typeof document === "undefined") {
      return null;
    }

    try {
      const match = document.cookie.match(
        new RegExp(`(?:^|;\\s*)${CATALOG_CARD_STYLE_COOKIE}=([^;]*)`),
      );
      return parseCatalogCardStyle(
        match?.[1] ? decodeURIComponent(match[1]) : null,
      );
    } catch {
      return null;
    }
  };

/** Client-only: cheapest synchronous read (dataset first, set by blocking script). */
export const readCatalogCardStyleClient = (): CatalogCardStyle | null => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }

  const fromDataset = parseCatalogCardStyle(
    document.documentElement.dataset.catalogCardStyle,
  );
  if (fromDataset) {
    return fromDataset;
  }

  const fromCookie = readCatalogCardStyleFromDocumentCookie();
  if (fromCookie) {
    return fromCookie;
  }

  try {
    const stored = window.localStorage.getItem(CATALOG_CARD_STYLE_STORAGE_KEY);
    const fromStorage = parseCatalogCardStyle(stored);
    if (fromStorage) {
      return fromStorage;
    }
  } catch {
    // Ignore storage access errors (e.g. private mode).
  }

  return null;
};

/**
 * Client-only: synchronously persist card style so the next paint and the
 * next hard load (blocking script + server cookie read) already match.
 * Safe to call inside zustand actions — runs before the next paint.
 */
export const persistCatalogCardStyleClient = (
  style: CatalogCardStyle,
): void => {
  if (typeof document === "undefined") {
    return;
  }

  try {
    document.documentElement.dataset.catalogCardStyle = style;
  } catch {
    // Ignore DOM errors.
  }

  try {
    document.cookie = `${CATALOG_CARD_STYLE_COOKIE}=${encodeURIComponent(style)}; path=/; max-age=31536000; SameSite=Lax`;
  } catch {
    // Ignore cookie errors.
  }

  try {
    window.localStorage.setItem(CATALOG_CARD_STYLE_STORAGE_KEY, style);
  } catch {
    // Ignore storage errors.
  }
};
