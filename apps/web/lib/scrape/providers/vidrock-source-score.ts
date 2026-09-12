export const isPackedHlsPagerUrl = (url: string): boolean => {
  try {
    const path = new URL(url).pathname;
    return /\/file3\//i.test(path) || /\/page-\d+\.html$/i.test(path);
  } catch {
    return /\/file3\//i.test(url) || /\/page-\d+\.html/i.test(url);
  }
};

const PACKED_PAGER_SCORE_PENALTY = 40;

export type VidrockScoredSource = {
  name: string;
  type: "hls" | "mp4" | "unknown";
  url: string;
};

export const scoreVidrockSource = (source: VidrockScoredSource): number => {
  const penalty = isPackedHlsPagerUrl(source.url)
    ? PACKED_PAGER_SCORE_PENALTY
    : 0;

  if (source.type === "hls") {
    if (/orion/i.test(source.name)) return 100 - penalty;
    if (/luna/i.test(source.name)) return 90 - penalty;
    return 80 - penalty;
  }
  if (source.type === "mp4") {
    if (/astra/i.test(source.name)) return 50 - penalty;
    if (/atlas/i.test(source.name)) return 40 - penalty;
    return 30 - penalty;
  }
  return 0;
};
