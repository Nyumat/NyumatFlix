/** Client-safe Hentaini slug helpers (no server-only scrape imports). */

export const slugifyHentainiTitle = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Hentaini often drops hyphens in romanized compounds (junyuu-chuu → junyuuchuu). */
export const expandHentainiSlugVariants = (slug: string): string[] => {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  const variants = new Set<string>([normalized]);

  if (normalized.includes("junyuu-chuu")) {
    variants.add(normalized.replace(/junyuu-chuu/g, "junyuuchuu"));
  }
  if (normalized.includes("junyu-chuu")) {
    variants.add(normalized.replace(/junyu-chuu/g, "junyuuchuu"));
  }

  return [...variants];
};

export const buildHentainiEpisodePath = (
  seriesSlug: string,
  episodeNumber: number,
): string => `/h/${seriesSlug}/${episodeNumber}`;
