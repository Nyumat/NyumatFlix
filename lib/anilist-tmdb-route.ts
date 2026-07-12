import "server-only";

import {
  getCachedAnilistTvMedia,
  type AniListTvMedia,
} from "@/lib/anilist-tv-detail";
import { getTmdbIdFromFribb, type FribbTmdbMapping } from "@/lib/fribb-mapping";
import { fetchIdsMoeMappingByAniListId } from "@/lib/ids-moe";
import { tmdb } from "@/tmdb/api";
import type { TvShowWithMediaType } from "@/tmdb/models";
import { unstable_cache } from "next/cache";

type ExactTmdbTvCandidate = {
  id: number;
  media_type: "tv";
  name: string;
  original_name: string;
  first_air_date: string;
  genre_ids: number[];
};

const ROUTE_MAPPING_REVALIDATE_SECONDS = 60 * 60 * 24;
const MAX_STRONG_TITLE_DATE_DRIFT_DAYS = 14;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

const normalizeTitle = (value: string | null | undefined) =>
  (value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const getSourceTitles = (media: AniListTvMedia) =>
  [media.title.english, media.title.romaji, media.title.native]
    .map(normalizeTitle)
    .filter((title, index, titles) => title && titles.indexOf(title) === index);

const getSourceAirDate = (media: AniListTvMedia) => {
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

export const selectExactTmdbTvRouteCandidate = (
  media: AniListTvMedia,
  candidates: ExactTmdbTvCandidate[],
): ExactTmdbTvCandidate | null => {
  const sourceTitles = new Set(getSourceTitles(media));
  const sourceAirDate = getSourceAirDate(media);
  if (sourceTitles.size === 0 || !sourceAirDate) return null;

  const matches = new Map<number, ExactTmdbTvCandidate>();

  for (const candidate of candidates) {
    if (!candidate.genre_ids.includes(16)) continue;

    const candidateTitles = new Set(
      [candidate.name, candidate.original_name]
        .map(normalizeTitle)
        .filter(Boolean),
    );
    const matchingTitleCount = [...candidateTitles].filter((title) =>
      sourceTitles.has(title),
    ).length;
    if (matchingTitleCount === 0) continue;

    const candidateAirDate = candidate.first_air_date ?? "";
    const dateMatches = sourceAirDate.includes("-")
      ? candidateAirDate === sourceAirDate ||
        (matchingTitleCount >= 2 &&
          (getDateDriftDays(sourceAirDate, candidateAirDate) ?? Infinity) <=
            MAX_STRONG_TITLE_DATE_DRIFT_DAYS)
      : candidateAirDate.startsWith(`${sourceAirDate}-`);
    if (!dateMatches) continue;

    matches.set(candidate.id, candidate);
  }

  return matches.size === 1 ? ([...matches.values()][0] ?? null) : null;
};

const findExactTmdbTvRoute = async (
  anilistId: number,
): Promise<FribbTmdbMapping | null> => {
  const media = await getCachedAnilistTvMedia(anilistId);
  if (!media || media.format === "MOVIE") return null;

  const queries = [
    media.title.english,
    media.title.romaji,
    media.title.native,
  ].filter(
    (title, index, titles): title is string =>
      Boolean(title?.trim()) && titles.indexOf(title) === index,
  );
  if (queries.length === 0) return null;

  const responses = await Promise.all(
    queries.map((query) => tmdb.search.multi({ query, adult: true })),
  );
  const candidates = responses.flatMap((response) =>
    (response.results ?? []).filter(
      (candidate): candidate is TvShowWithMediaType =>
        candidate.media_type === "tv",
    ),
  );
  const match = selectExactTmdbTvRouteCandidate(media, candidates);

  return match ? { id: match.id, type: "tv" } : null;
};

const getCachedExactTmdbTvRoute = unstable_cache(
  findExactTmdbTvRoute,
  ["anilist-tmdb-exact-tv-route-v2"],
  { revalidate: ROUTE_MAPPING_REVALIDATE_SECONDS },
);

export const resolveAnilistTvTmdbRoute = async (
  anilistId: number,
): Promise<FribbTmdbMapping | null> => {
  const fribbMapping = await getTmdbIdFromFribb(anilistId);
  if (fribbMapping) return fribbMapping;

  const idsMoeMapping = await fetchIdsMoeMappingByAniListId(anilistId);
  if (idsMoeMapping?.themoviedb && idsMoeMapping.themoviedb_type === "tv") {
    return { id: idsMoeMapping.themoviedb, type: "tv" };
  }

  return getCachedExactTmdbTvRoute(anilistId);
};
