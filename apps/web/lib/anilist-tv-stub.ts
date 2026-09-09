import type { TvShowDetails } from "@/lib/domain/typings";
import type { FribbAnimeRow } from "@/lib/fribb-mapping";
import type { AniListTvMedia } from "@/lib/anilist-tv-detail";
import { isKnownTmdbZeroSeasonSpecial } from "@/lib/anime/special-sequel-appendix";

const fribbTmdbSeasonNumber = (row: FribbAnimeRow): number => {
  const season = row.season?.tmdb;
  if (season === undefined || season === null || season === 0) {
    return 1;
  }
  return season;
};

const parseYear = (value: string | null | undefined): number | null => {
  const year = Number.parseInt((value ?? "").slice(0, 4), 10);
  return Number.isInteger(year) && year > 0 ? year : null;
};

const isGenericSeasonName = (name: string | null | undefined): boolean =>
  /^season\s+\d+$/i.test(name?.trim() ?? "");

export const buildAniListTvMediaStubFromTmdb = (
  anilistId: number,
  tmdbShow: TvShowDetails,
  fribbRow: FribbAnimeRow | undefined,
): AniListTvMedia => {
  const tmdbSeasonNumber = fribbRow ? fribbTmdbSeasonNumber(fribbRow) : null;
  const tmdbSeason =
    tmdbSeasonNumber === null
      ? null
      : tmdbShow.seasons?.find(
          (season) => season.season_number === tmdbSeasonNumber,
        );
  const title = fribbRow
    ? (!isGenericSeasonName(tmdbSeason?.name) && tmdbSeason?.name?.trim()) ||
      tmdbShow.name?.trim() ||
      tmdbShow.original_name?.trim() ||
      "Untitled"
    : tmdbShow.name?.trim() || tmdbShow.original_name?.trim() || "Untitled";
  const year =
    parseYear(tmdbSeason?.air_date) ??
    parseYear(tmdbShow.first_air_date) ??
    parseYear(tmdbShow.last_air_date);

  const isZeroSeasonSpecial = isKnownTmdbZeroSeasonSpecial(anilistId);

  return {
    id: anilistId,
    type: "ANIME",
    title: {
      english: title,
      romaji: tmdbShow.original_name ?? title,
      native: tmdbShow.original_name ?? null,
    },
    description: tmdbSeason?.overview || tmdbShow.overview || null,
    coverImage:
      tmdbSeason?.poster_path || tmdbShow.poster_path
        ? {
            large: tmdbSeason?.poster_path ?? tmdbShow.poster_path ?? null,
            extraLarge: tmdbSeason?.poster_path ?? tmdbShow.poster_path ?? null,
          }
        : null,
    bannerImage: tmdbShow.backdrop_path ?? tmdbShow.poster_path ?? null,
    genres:
      tmdbShow.genres?.map((genre) => genre.name ?? "").filter(Boolean) ?? [],
    averageScore: tmdbShow.vote_average
      ? Math.round(tmdbShow.vote_average * 10)
      : null,
    popularity: tmdbShow.popularity ?? null,
    favourites: tmdbShow.vote_count ?? null,
    episodes: isZeroSeasonSpecial
      ? 1
      : (tmdbSeason?.episode_count ?? tmdbShow.number_of_episodes ?? null),
    duration: tmdbShow.episode_run_time?.[0] ?? null,
    status: "FINISHED",
    format: isZeroSeasonSpecial ? "SPECIAL" : "TV",
    seasonYear: year,
    startDate: year ? { year, month: 1, day: 1 } : null,
    characters: { edges: [] },
    relations: { edges: [] },
  };
};
