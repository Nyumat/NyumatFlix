import type { CatalogCardStyle } from "@/lib/user/user-settings-types";

export const CATALOG_CARD_STYLE_COOKIE = "nf-catalog-card-style";
const CATALOG_CARD_STYLE_STORAGE_KEY = "nyumatflix:catalog-card-style";

export const parseCatalogCardStyle = (
  value: unknown,
): CatalogCardStyle | null =>
  value === "poster" || value === "backdrop" ? value : null;

/** Cookie is a saved device choice. A lock or a missing cookie uses the experience default. */
export const resolveCatalogCardStyleSnapshot = (
  cookieValue: string | undefined,
  experienceDefault: CatalogCardStyle,
  locked = false,
): CatalogCardStyle => {
  if (locked) {
    return experienceDefault;
  }
  return parseCatalogCardStyle(cookieValue) ?? experienceDefault;
};

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

/** Saved device choice only. The paint dataset is not a choice. */
export const readDeviceCatalogCardStyle = (): CatalogCardStyle | null => {
  const fromCookie = readCatalogCardStyleFromDocumentCookie();
  if (fromCookie) {
    return fromCookie;
  }

  if (typeof window === "undefined") {
    return null;
  }

  try {
    return parseCatalogCardStyle(
      window.localStorage.getItem(CATALOG_CARD_STYLE_STORAGE_KEY),
    );
  } catch {
    return null;
  }
};

export const catalogCardStyleBootstrapScript = (
  experienceDefault: CatalogCardStyle,
  locked: boolean,
): string => {
  const fallback = experienceDefault === "poster" ? "poster" : "backdrop";
  return `(function(){try{var d=document.documentElement;var fallback=${JSON.stringify(fallback)};if(${locked ? "true" : "false"}){d.dataset.catalogCardStyle=fallback;return;}var m=document.cookie.match(/(?:^|;\\s*)${CATALOG_CARD_STYLE_COOKIE}=([^;]*)/);var v=m&&m[1]?decodeURIComponent(m[1]):null;if(v!=='poster'&&v!=='backdrop'){try{v=localStorage.getItem(${JSON.stringify(CATALOG_CARD_STYLE_STORAGE_KEY)});}catch(e){v=null;}}if(v!=='poster'&&v!=='backdrop'){v=fallback;}d.dataset.catalogCardStyle=v;}catch(e){}})();`;
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
