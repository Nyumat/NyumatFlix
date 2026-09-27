import type { ScrapeMediaType } from "../types";

export type KisskhSearchHit = {
  id: number;
  title: string;
};

export type KisskhEpisode = {
  id: number;
  number: number;
};

export type KisskhDramaCandidate = {
  id: number;
  title: string;
  type?: string;
  episodes: KisskhEpisode[];
};

export const KISSKH_DETAIL_LOOKUP_LIMIT = 4;

export const normalizeKisskhTitle = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const isMovieType = (type: string | undefined): boolean =>
  (type ?? "").trim().toLowerCase() === "movie";

export const pickKisskhSearchHits = (
  hits: readonly KisskhSearchHit[],
  title: string,
): KisskhSearchHit[] => {
  const normalized = normalizeKisskhTitle(title);
  if (!normalized) {
    return [];
  }

  return hits.filter((hit) => normalizeKisskhTitle(hit.title) === normalized);
};

export const pickKisskhDrama = (
  dramas: readonly KisskhDramaCandidate[],
  mediaType: ScrapeMediaType,
): KisskhDramaCandidate | null => {
  if (dramas.length === 0) {
    return null;
  }

  if (mediaType === "movie") {
    return dramas.find((drama) => isMovieType(drama.type)) ?? dramas[0] ?? null;
  }

  return dramas.find((drama) => !isMovieType(drama.type)) ?? dramas[0] ?? null;
};

export const pickKisskhEpisode = (
  episodes: readonly KisskhEpisode[],
  input: {
    mediaType: ScrapeMediaType;
    episodeNumber?: number;
  },
): KisskhEpisode | null => {
  if (episodes.length === 0) {
    return null;
  }

  if (input.mediaType === "movie") {
    return (
      episodes.find((episode) => episode.number === 1) ??
      (episodes.length === 1 ? episodes[0]! : null)
    );
  }

  if (input.episodeNumber == null) {
    return null;
  }

  return (
    episodes.find((episode) => episode.number === input.episodeNumber) ?? null
  );
};
