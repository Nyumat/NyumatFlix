export type ParsedRange = {
  start: number;
  end: number | null;
};

export const parseMappingRange = (range: string): ParsedRange | null => {
  const trimmed = range.trim().replace(/-$/, "");
  const match = /^(\d+)(?:-(\d+))?$/.exec(trimmed);
  if (!match) return null;

  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : start;
  if (!Number.isInteger(start) || !Number.isInteger(end)) return null;

  return { start, end };
};

export const episodeInMappingRange = (
  episode: number,
  sourceRange: string,
): boolean => {
  const openEnded =
    sourceRange.trim().endsWith("-") && !/\d+-\d+-$/.test(sourceRange.trim());
  const parsed = parseMappingRange(sourceRange);
  if (!parsed) return false;

  if (openEnded) {
    return episode >= parsed.start;
  }

  return episode >= parsed.start && episode <= (parsed.end ?? parsed.start);
};

export const mapEpisodeAcrossRanges = (
  episode: number,
  rangeMap: Record<string, string>,
): number | null => {
  for (const [sourceRange, targetSpec] of Object.entries(rangeMap)) {
    if (!episodeInMappingRange(episode, sourceRange)) continue;

    const source = parseMappingRange(sourceRange.replace(/-$/, ""));
    if (!source) continue;

    const targetPart = targetSpec.split("|")[0]?.split(",")[0] ?? "";
    const target = parseMappingRange(targetPart.replace(/-$/, ""));
    if (!target) continue;

    return target.start + (episode - source.start);
  }

  return null;
};
