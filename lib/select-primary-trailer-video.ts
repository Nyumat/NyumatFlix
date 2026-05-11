export type TrailerPickRow = {
  type: string;
  key: string;
  site?: string;
  official?: boolean;
  published_at?: string;
};

const parsePublishedAtMs = (iso?: string): number => {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
};

const sortByOfficialThenDate = <T extends TrailerPickRow>(
  a: T,
  b: T,
): number => {
  const officialRank = (v: T) => (v.official === true ? 1 : 0);
  const diff = officialRank(b) - officialRank(a);
  if (diff !== 0) return diff;
  return (
    parsePublishedAtMs(b.published_at) - parsePublishedAtMs(a.published_at)
  );
};

const isYoutube = (v: TrailerPickRow): boolean =>
  !v.site || v.site === "YouTube";

const pickBestInPool = <T extends TrailerPickRow>(
  pool: readonly T[],
): T | undefined => {
  if (pool.length === 0) return undefined;
  return [...pool].sort(sortByOfficialThenDate)[0];
};

export const extractVideoRowsFromMediaVideos = (
  videos: unknown,
): TrailerPickRow[] => {
  if (!videos) return [];
  if (Array.isArray(videos)) {
    return videos as TrailerPickRow[];
  }
  if (typeof videos === "object") {
    const o = videos as { results?: unknown };
    if (Array.isArray(o.results)) {
      return o.results as TrailerPickRow[];
    }
  }
  return [];
};

export const selectPrimaryTrailerVideo = <T extends TrailerPickRow>(
  rows: readonly T[],
): T | undefined => {
  const trailers = rows.filter(
    (v) => v.type === "Trailer" && v.key && isYoutube(v),
  );
  const fromTrailers = pickBestInPool(trailers);
  if (fromTrailers) return fromTrailers;

  const teasers = rows.filter(
    (v) => v.type === "Teaser" && v.key && isYoutube(v),
  );
  return pickBestInPool(teasers);
};

export const selectPrimaryTrailerKey = (
  rows: readonly TrailerPickRow[],
): string | undefined => selectPrimaryTrailerVideo(rows)?.key;
