import "server-only";

import {
  getCachedAnilistTvMedia,
  type AniListTvMedia,
} from "@/lib/anilist-tv-detail";
import { getTmdbIdFromFribb, type FribbTmdbMapping } from "@/lib/fribb-mapping";
import { fetchIdsMoeMappingByAniListId } from "@/lib/ids-moe";
import {
  dedupeTmdbTvCandidates,
  getAnilistAirDate,
  getAnilistTitlesForTmdbMatch,
  normalizeTitleForTmdbMatch,
  pickBestTmdbTvCandidate,
  type TmdbTvMatchCandidate,
} from "@/lib/anilist-tmdb-match";
import { tmdb } from "@/tmdb/api";
import type { TvShowWithMediaType } from "@/tmdb/models";
import { unstable_cache } from "next/cache";

const ROUTE_MAPPING_REVALIDATE_SECONDS = 60 * 60 * 24;
const MAX_STRONG_TITLE_DATE_DRIFT_DAYS = 14;

const getDateDriftDays = (firstDate: string, secondDate: string) => {
  const firstTimestamp = Date.parse(`${firstDate}T00:00:00Z`);
  const secondTimestamp = Date.parse(`${secondDate}T00:00:00Z`);
  if (!Number.isFinite(firstTimestamp) || !Number.isFinite(secondTimestamp)) {
    return null;
  }

  return Math.abs(firstTimestamp - secondTimestamp) / (24 * 60 * 60 * 1000);
};

export const selectExactTmdbTvRouteCandidate = (
  media: AniListTvMedia,
  candidates: TmdbTvMatchCandidate[],
): TmdbTvMatchCandidate | null => {
  const sourceTitles = new Set(
    getAnilistTitlesForTmdbMatch(media).map(normalizeTitleForTmdbMatch),
  );
  const sourceAirDate = getAnilistAirDate(media);
  if (sourceTitles.size === 0 || !sourceAirDate) return null;

  const matches = new Map<number, TmdbTvMatchCandidate>();

  for (const candidate of candidates) {
    if (!candidate.genre_ids.includes(16)) continue;

    const candidateTitles = new Set(
      [candidate.name, candidate.original_name]
        .map(normalizeTitleForTmdbMatch)
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

  const uniqueMatches = dedupeTmdbTvCandidates([...matches.values()]);
  if (uniqueMatches.length === 1) {
    return uniqueMatches[0] ?? null;
  }

  if (uniqueMatches.length > 1) {
    return pickBestTmdbTvCandidate(media, uniqueMatches, 55);
  }

  return null;
};

const findExactTmdbTvRoute = async (
  anilistId: number,
): Promise<FribbTmdbMapping | null> => {
  const media = await getCachedAnilistTvMedia(anilistId);
  if (!media || media.format === "MOVIE") return null;

  const queries = getAnilistTitlesForTmdbMatch(media);
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
  const match = selectExactTmdbTvRouteCandidate(
    media,
    candidates.map((candidate) => ({
      id: candidate.id,
      media_type: "tv",
      name: candidate.name,
      original_name: candidate.original_name,
      first_air_date: candidate.first_air_date ?? "",
      genre_ids: candidate.genre_ids ?? [],
      popularity: candidate.popularity,
      vote_average: candidate.vote_average,
    })),
  );

  return match ? { id: match.id, type: "tv" } : null;
};

const getCachedExactTmdbTvRoute = unstable_cache(
  findExactTmdbTvRoute,
  ["anilist-tmdb-exact-tv-route-v3"],
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
