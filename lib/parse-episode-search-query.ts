import type { Episode } from "@/utils/typings";

export type ParsedEpisodeSearchQuery = {
  season?: number;
  episode?: number;
  keywords: string[];
};

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "in",
  "to",
  "for",
  "on",
  "at",
  "by",
]);

const normalizeWhitespace = (raw: string): string =>
  raw.toLowerCase().trim().replace(/\s+/g, " ");

const splitKeywords = (s: string): string[] => {
  const words = s
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0 && !STOPWORDS.has(w));
  return words;
};

export const parseEpisodeSearchQuery = (raw: string): ParsedEpisodeSearchQuery => {
  let s = normalizeWhitespace(raw);
  let season: number | undefined;
  let episode: number | undefined;

  const trySxe = (): boolean => {
    const sxe = /\bs\s*(\d{1,3})\s*e\s*(\d{1,4})\b/i;
    const m = s.match(sxe);
    if (m) {
      season = Number(m[1]);
      episode = Number(m[2]);
      s = s.replace(m[0], " ");
      return true;
    }
    return false;
  };

  if (!trySxe()) {
    const xm = s.match(/\b(\d{1,2})\s*x\s*(\d{1,4})\b/);
    if (xm) {
      season = Number(xm[1]);
      episode = Number(xm[2]);
      s = s.replace(xm[0], " ");
    } else {
      const dotm = s.match(/\b(\d{1,2})\s*\.\s*(\d{1,4})\b/);
      if (dotm) {
        season = Number(dotm[1]);
        episode = Number(dotm[2]);
        s = s.replace(dotm[0], " ");
      }
    }
  }

  s = normalizeWhitespace(s);

  const seasonPhrase = /\b(?:season|series)\s+(\d+)\b/gi;
  let sm: RegExpExecArray | null;
  while ((sm = seasonPhrase.exec(s)) !== null) {
    season = Number(sm[1]);
  }
  s = s.replace(/\b(?:season|series)\s+(\d+)\b/gi, " ");

  const episodePhrase = /\b(?:episode|ep)\.?\s+(\d+)\b/gi;
  while ((sm = episodePhrase.exec(s)) !== null) {
    episode = Number(sm[1]);
  }
  s = s.replace(/\b(?:episode|ep)\.?\s+(\d+)\b/gi, " ");

  s = normalizeWhitespace(s);
  const keywords = splitKeywords(s);

  return { season, episode, keywords };
};

const titleMatchesKeywords = (titleLower: string, keywords: string[]): boolean => {
  if (keywords.length === 0) return true;
  return keywords.every((kw) => titleLower.includes(kw));
};

const keywordMatchesEpisodeField = (
  kw: string,
  episode: Episode,
  seasonNumber: number,
  titleLower: string,
): boolean => {
  if (titleLower.includes(kw)) return true;
  if (String(episode.episode_number).includes(kw)) return true;
  if (String(seasonNumber).includes(kw)) return true;
  const label = `s${seasonNumber}e${episode.episode_number}`;
  const labelAlt = `${seasonNumber}x${episode.episode_number}`;
  const seasonWord = `season ${seasonNumber}`;
  if (label.includes(kw) || labelAlt.includes(kw)) return true;
  if (`s${seasonNumber}`.includes(kw) || seasonWord.includes(kw)) return true;
  if (`${seasonNumber}.${episode.episode_number}`.includes(kw)) return true;
  return false;
};

export const matchesEpisodeSearch = (
  episode: Episode,
  seasonNumber: number,
  titleLower: string,
  parsed: ParsedEpisodeSearchQuery,
  rawQuery: string,
): boolean => {
  const { season, episode: epNum, keywords } = parsed;

  if (season !== undefined && epNum !== undefined) {
    return (
      seasonNumber === season &&
      episode.episode_number === epNum &&
      titleMatchesKeywords(titleLower, keywords)
    );
  }

  if (season !== undefined) {
    return seasonNumber === season && titleMatchesKeywords(titleLower, keywords);
  }

  if (epNum !== undefined) {
    return episode.episode_number === epNum && titleMatchesKeywords(titleLower, keywords);
  }

  const q = normalizeWhitespace(rawQuery);
  if (!q) return true;

  const words = parsed.keywords.length > 0 ? parsed.keywords : splitKeywords(q);
  if (words.length > 0) {
    const allWordsMatch = words.every((kw) =>
      keywordMatchesEpisodeField(kw, episode, seasonNumber, titleLower),
    );
    if (allWordsMatch) return true;
  }

  return (
    titleLower.includes(q) ||
    String(episode.episode_number).includes(q) ||
    String(seasonNumber).includes(q) ||
    `${seasonNumber}x${episode.episode_number}`.includes(q) ||
    `${seasonNumber}.${episode.episode_number}`.includes(q) ||
    `s${seasonNumber}`.includes(q) ||
    `season ${seasonNumber}`.includes(q)
  );
};
