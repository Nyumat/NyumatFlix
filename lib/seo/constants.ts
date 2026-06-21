import { SITE_URL } from "@/lib/constants";

export const DEFAULT_OG_IMAGE = `${SITE_URL}/opengraph-image`;
export const DEFAULT_OG_IMAGE_TYPE = "image/png";

export const OG_IMAGE_SIZE = {
  width: 1200,
  height: 630,
} as const;

export const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

export const tmdbImageUrl = (
  path: string | null | undefined,
  size: "w342" | "w500" | "w780" | "w1280" | "original" = "w780",
) => (path ? `${TMDB_IMAGE_BASE}/${size}${path}` : null);

export const buildCanonicalUrl = (path = "/") => {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${normalized === "/" ? "" : normalized}`;
};
