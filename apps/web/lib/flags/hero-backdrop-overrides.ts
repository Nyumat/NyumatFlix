/**
 * Per-title hero backdrop overrides.
 *
 * Stored as JSON metadata on the `global.hero_backdrop_overrides` Flipt flag
 * (see `flipt-client.ts`). Resolution happens on the server so the chosen
 * image is part of the initial RSC payload — no post-hydration flash.
 */

export type HeroBackdropOverrideMediaType = "movie" | "tv" | "anime";

export type HeroBackdropOverrideSource = "tmdb" | "anilist" | "mal" | "custom";

export type HeroBackdropOverrideEntry = {
  /** Stable lookup key, e.g. `movie:969681` or `anime:1735`. */
  key: string;
  mediaType: HeroBackdropOverrideMediaType;
  title: string;
  tmdbId: number | null;
  anilistId: number | null;
  malId: number | null;
  /** TMDB file path (`/abc.jpg`) or an absolute `https://…` URL. */
  path: string;
  source: HeroBackdropOverrideSource;
  /** Human-readable provenance shown in the admin UI. */
  label: string;
  updatedAt: string;
};

export type HeroBackdropOverridesConfig = {
  version: 1;
  entries: HeroBackdropOverrideEntry[];
};

export const DEFAULT_HERO_BACKDROP_OVERRIDES: HeroBackdropOverridesConfig = {
  version: 1,
  entries: [],
};

export const HERO_BACKDROP_OVERRIDES_MAX_ENTRIES = 1000;

const MEDIA_TYPES: readonly HeroBackdropOverrideMediaType[] = [
  "movie",
  "tv",
  "anime",
];

const SOURCES: readonly HeroBackdropOverrideSource[] = [
  "tmdb",
  "anilist",
  "mal",
  "custom",
];

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

export type HeroBackdropOverrideMatch = {
  mediaType?: HeroBackdropOverrideMediaType;
  tmdbId?: number | null;
  anilistId?: number | null;
  malId?: number | null;
};

const toPositiveInt = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const parsed = Number.parseInt(value, 10);
    return parsed > 0 ? parsed : null;
  }
  return null;
};

const clampText = (value: unknown, maxLength: number): string =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

/** Accepts TMDB file paths and absolute http(s) URLs; rejects everything else. */
export const isAllowedHeroBackdropPath = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  const path = value.trim();
  if (!path) return false;

  if (path.startsWith("/") && !path.startsWith("//")) {
    return !/\s/.test(path);
  }

  try {
    const url = new URL(path);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};

export const heroBackdropPreviewUrl = (
  path: string,
  size: "w780" | "w1280" | "original" = "w780",
): string => {
  const trimmed = path.trim();
  if (/^https?:\/\//.test(trimmed)) return trimmed;
  return `${TMDB_IMAGE_BASE}/${size}/${trimmed.replace(/^\/+/, "")}`;
};

export const heroBackdropOverrideKey = (
  mediaType: HeroBackdropOverrideMediaType,
  ids: {
    tmdbId?: number | null;
    anilistId?: number | null;
    malId?: number | null;
  },
): string => {
  const id = ids.tmdbId ?? ids.anilistId ?? ids.malId;
  return `${mediaType}:${id ?? "unknown"}`;
};

const sanitizeEntry = (value: unknown): HeroBackdropOverrideEntry | null => {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;

  const mediaType = MEDIA_TYPES.includes(
    raw.mediaType as HeroBackdropOverrideMediaType,
  )
    ? (raw.mediaType as HeroBackdropOverrideMediaType)
    : null;
  if (!mediaType) return null;

  const path = typeof raw.path === "string" ? raw.path.trim() : "";
  if (!isAllowedHeroBackdropPath(path)) return null;

  const tmdbId = toPositiveInt(raw.tmdbId);
  const anilistId = toPositiveInt(raw.anilistId);
  const malId = toPositiveInt(raw.malId);
  if (!tmdbId && !anilistId && !malId) return null;

  const source = SOURCES.includes(raw.source as HeroBackdropOverrideSource)
    ? (raw.source as HeroBackdropOverrideSource)
    : "tmdb";

  const key = clampText(raw.key, 120);
  const title = clampText(raw.title, 200) || key || "Untitled";
  const label = clampText(raw.label, 120) || source;
  const updatedAt = clampText(raw.updatedAt, 40);

  return {
    key:
      key || heroBackdropOverrideKey(mediaType, { tmdbId, anilistId, malId }),
    mediaType,
    title,
    tmdbId,
    anilistId,
    malId,
    path,
    source,
    label,
    updatedAt,
  };
};

export function sanitizeHeroBackdropOverridesConfig(
  value: unknown,
): HeroBackdropOverridesConfig {
  const raw = value && typeof value === "object" ? value : {};
  const entriesInput = Array.isArray((raw as { entries?: unknown }).entries)
    ? ((raw as { entries: unknown[] }).entries ?? [])
    : [];

  const byKey = new Map<string, HeroBackdropOverrideEntry>();
  for (const candidate of entriesInput) {
    const entry = sanitizeEntry(candidate);
    if (!entry) continue;
    byKey.set(entry.key, entry);
    if (byKey.size >= HERO_BACKDROP_OVERRIDES_MAX_ENTRIES) break;
  }

  return { version: 1, entries: [...byKey.values()] };
}

export function heroBackdropOverridesEquals(
  left: HeroBackdropOverridesConfig,
  right: HeroBackdropOverridesConfig,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

const idsOverlap = (
  entry: HeroBackdropOverrideEntry,
  match: HeroBackdropOverrideMatch,
): boolean => {
  if (match.mediaType && entry.mediaType !== match.mediaType) {
    return false;
  }
  if (match.tmdbId && entry.tmdbId && entry.tmdbId === match.tmdbId) {
    return true;
  }
  if (
    match.anilistId &&
    entry.anilistId &&
    entry.anilistId === match.anilistId
  ) {
    return true;
  }
  if (match.malId && entry.malId && entry.malId === match.malId) {
    return true;
  }
  return false;
};

function findIn(
  entries: readonly HeroBackdropOverrideEntry[],
  match: HeroBackdropOverrideMatch,
): HeroBackdropOverrideEntry | null {
  if (match.tmdbId) {
    const byTmdb = entries.find(
      (entry) => entry.tmdbId && entry.tmdbId === match.tmdbId,
    );
    if (byTmdb) return byTmdb;
  }
  if (match.anilistId) {
    const byAnilist = entries.find(
      (entry) => entry.anilistId && entry.anilistId === match.anilistId,
    );
    if (byAnilist) return byAnilist;
  }
  if (match.malId) {
    const byMal = entries.find(
      (entry) => entry.malId && entry.malId === match.malId,
    );
    if (byMal) return byMal;
  }
  return null;
}

/**
 * Finds the override that should win for a content match. TMDB identity is the
 * strongest match, then AniList, then MAL.
 */
export function findHeroBackdropOverride(
  config: HeroBackdropOverridesConfig,
  match: HeroBackdropOverrideMatch,
): HeroBackdropOverrideEntry | null {
  if (match.mediaType) {
    const scoped = config.entries.filter(
      (entry) => entry.mediaType === match.mediaType,
    );
    if (scoped.length > 0) {
      const found = findIn(scoped, match);
      if (found) return found;
    }
  }

  return findIn(config.entries, match);
}

/** Adds/replaces an entry, dropping any prior override for the same content. */
export function upsertHeroBackdropOverride(
  config: HeroBackdropOverridesConfig,
  entry: HeroBackdropOverrideEntry,
): HeroBackdropOverridesConfig {
  const sanitized = sanitizeEntry(entry);
  if (!sanitized) return config;

  const remaining = config.entries.filter(
    (existing) =>
      existing.key !== sanitized.key && !idsOverlap(existing, sanitized),
  );

  return sanitizeHeroBackdropOverridesConfig({
    version: 1,
    entries: [...remaining, sanitized],
  });
}

export function patchHeroBackdropOverride(
  config: HeroBackdropOverridesConfig,
  key: string,
  patch: Pick<HeroBackdropOverrideEntry, "path" | "source" | "label">,
): HeroBackdropOverridesConfig {
  const entries = config.entries.map((existing) => {
    if (existing.key !== key) return existing;
    return (
      sanitizeEntry({
        ...existing,
        ...patch,
        updatedAt: new Date().toISOString(),
      }) ?? existing
    );
  });

  return sanitizeHeroBackdropOverridesConfig({ version: 1, entries });
}

export function removeHeroBackdropOverride(
  config: HeroBackdropOverridesConfig,
  key: string,
): HeroBackdropOverridesConfig {
  return sanitizeHeroBackdropOverridesConfig({
    version: 1,
    entries: config.entries.filter((entry) => entry.key !== key),
  });
}

/** Applies an override to a media-ish object by replacing `backdrop_path`. */
export function withHeroBackdropOverride<
  T extends { backdrop_path?: string | null },
>(item: T, entry: HeroBackdropOverrideEntry | null): T {
  if (!entry) return item;
  return { ...item, backdrop_path: entry.path } as T;
}
