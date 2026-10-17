const DISABLE_HERO_TRAILERS_KEY = "nyumatflix:disable-hero-trailers";
const DISABLE_HOVER_SOUND_KEY = "nyumatflix:disable-hover-sound";

const parseBoolean = (value: string | null): boolean | null => {
  if (value === "1" || value === "true") return true;
  if (value === "0" || value === "false") return false;
  return null;
};

export const readDisableHeroTrailersClient = (): boolean | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return parseBoolean(window.localStorage.getItem(DISABLE_HERO_TRAILERS_KEY));
  } catch {
    return null;
  }
};

export const readDisableHoverSoundClient = (): boolean | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return parseBoolean(window.localStorage.getItem(DISABLE_HOVER_SOUND_KEY));
  } catch {
    return null;
  }
};

export const persistDisableHeroTrailersClient = (enabled: boolean): void => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(DISABLE_HERO_TRAILERS_KEY, enabled ? "1" : "0");
  } catch {
    // Ignore storage errors.
  }
};

export const persistDisableHoverSoundClient = (enabled: boolean): void => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(DISABLE_HOVER_SOUND_KEY, enabled ? "1" : "0");
  } catch {
    // Ignore storage errors.
  }
};
