import type { AniListTvMedia } from "@/lib/anilist-tv-detail";
import { expandAdultAnimeSearchQueries } from "@/lib/scrape/anime/adult-title-slug-aliases";

export type TmdbTvMatchCandidate = {
  id: number;
  media_type: "tv";
  name: string;
  original_name: string;
  first_air_date: string;
  genre_ids: number[];
  popularity?: number;
  vote_average?: number;
};

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_STRONG_TITLE_DATE_DRIFT_DAYS = 14;

export const normalizeTitleForTmdbMatch = (value: string | null | undefined) =>
  (value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/\bhaha\b/g, "gibo")
    .replace(/\byanmama\b/g, "yan mama")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

export const getAnilistTitlesForTmdbMatch = (media: AniListTvMedia) => {
  const base = [
    media.title.english,
    media.title.romaji,
    media.title.native,
  ].filter((title): title is string => Boolean(title?.trim()));

  return expandAdultAnimeSearchQueries(base);
};

export const getAnilistAirDate = (media: AniListTvMedia) => {
  const year = media.startDate?.year ?? media.seasonYear;
  if (!year) return null;

  const month = media.startDate?.month;
  const day = media.startDate?.day;
  if (!month || !day) return String(year);

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

const getDateDriftDays = (firstDate: string, secondDate: string) => {
  const firstTimestamp = Date.parse(`${firstDate}T00:00:00Z`);
  const secondTimestamp = Date.parse(`${secondDate}T00:00:00Z`);
  if (!Number.isFinite(firstTimestamp) || !Number.isFinite(secondTimestamp)) {
    return null;
  }

  return Math.abs(firstTimestamp - secondTimestamp) / MILLISECONDS_PER_DAY;
};

export const scoreTmdbTvCandidate = (
  media: AniListTvMedia,
  candidate: TmdbTvMatchCandidate,
): number => {
  const titles = getAnilistTitlesForTmdbMatch(media);
  const normalizedTitles = titles.map(normalizeTitleForTmdbMatch);
  const candidateTitles = [
    normalizeTitleForTmdbMatch(candidate.name),
    normalizeTitleForTmdbMatch(candidate.original_name),
  ].filter(Boolean);

  const exactTitle = normalizedTitles.some((title) =>
    candidateTitles.some((candidateTitle) => title && title === candidateTitle),
  );
  const containsTitle = normalizedTitles.some((title) => {
    if (!title || title.length < 4) return false;
    return candidateTitles.some(
      (candidateTitle) =>
        candidateTitle.includes(title) || title.includes(candidateTitle),
    );
  });

  const sourceAirDate = getAnilistAirDate(media);
  const candidateAirDate = candidate.first_air_date ?? "";
  const candidateYear = Number.parseInt(candidateAirDate.slice(0, 4), 10);
  const sourceYear = sourceAirDate
    ? Number.parseInt(sourceAirDate.slice(0, 4), 10)
    : Number.NaN;
  const yearDelta =
    Number.isInteger(sourceYear) && Number.isInteger(candidateYear)
      ? Math.abs(candidateYear - sourceYear)
      : 99;
  const dateDrift =
    sourceAirDate && candidateAirDate
      ? getDateDriftDays(sourceAirDate, candidateAirDate)
      : null;

  let score = 0;
  if (candidate.genre_ids.includes(16)) score += 20;
  if (exactTitle) score += 50;
  else if (containsTitle) score += 15;
  if (yearDelta === 0) score += 20;
  else if (yearDelta <= 1) score += 10;
  else if (yearDelta > 2) score -= 15;
  if (dateDrift !== null && dateDrift <= MAX_STRONG_TITLE_DATE_DRIFT_DAYS) {
    score += 10;
  }
  score += Math.min(candidate.popularity ?? 0, 50) / 10;
  score += Math.min(candidate.vote_average ?? 0, 10);

  return score;
};

export const dedupeTmdbTvCandidates = (
  candidates: TmdbTvMatchCandidate[],
): TmdbTvMatchCandidate[] => {
  const byId = new Map<number, TmdbTvMatchCandidate>();
  for (const candidate of candidates) {
    byId.set(candidate.id, candidate);
  }
  return [...byId.values()];
};

export const pickBestTmdbTvCandidate = (
  media: AniListTvMedia,
  candidates: TmdbTvMatchCandidate[],
  minimumScore = 45,
): TmdbTvMatchCandidate | null => {
  const unique = dedupeTmdbTvCandidates(candidates);
  const ranked = unique
    .map((candidate) => ({
      candidate,
      score: scoreTmdbTvCandidate(media, candidate),
    }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (!best || best.score < minimumScore) return null;

  const runnerUp = ranked[1];
  if (
    runnerUp &&
    runnerUp.score >= minimumScore &&
    runnerUp.score >= best.score - 5
  ) {
    return null;
  }

  return best.candidate;
};
