export type ResolvedChapter = {
  title: string;
  start: number;
  end: number;
};

export const findChapterAtTime = (
  chapters: ResolvedChapter[],
  time: number,
): ResolvedChapter | null => {
  if (!Number.isFinite(time) || time < 0) {
    return null;
  }

  return (
    chapters.find((chapter) => time >= chapter.start && time < chapter.end) ??
    null
  );
};

export const chapterSegmentPercent = (
  chapter: ResolvedChapter,
  duration: number,
): { left: number; width: number } => {
  if (!Number.isFinite(duration) || duration <= 0) {
    return { left: 0, width: 0 };
  }

  const left = (chapter.start / duration) * 100;
  const width = ((chapter.end - chapter.start) / duration) * 100;
  return { left, width };
};

const INTRO_DB_SEGMENT_TYPES = new Set([
  "intro",
  "recap",
  "credits",
  "preview",
]);

export const introDbSegmentClassName = (title: string): string | null => {
  const normalized = title.trim().toLowerCase();
  if (!INTRO_DB_SEGMENT_TYPES.has(normalized)) {
    return null;
  }
  return `movi-chapter-segment--${normalized}`;
};
