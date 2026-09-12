import "server-only";

import {
  buildMergedEpisodesForTmdbSeason,
  collectFribbAnilistIdsForTmdbSeason,
  type SeasonEpisodeSource,
} from "@/lib/anilist-franchise-display";
import { appendKnownSpecialSequelIds } from "@/lib/anime/special-sequel-appendix";
import { overlayKnownTmdbZeroSeasonSpecials } from "@/lib/anime/tmdb-zero-season-overlay";
import { mergeTmdbEpisodesIntoSeason } from "@/lib/anilist-tv-episode-merge";
import { hasFribbSplitCourForTmdbSeason } from "@/lib/anime/split-cour-appendix";
import { getSeasonIndexEntry } from "@/lib/anime/season-index";
import { buildEpisodesFromMappingSegments } from "@/lib/anime/tmdb-anilist-map";
import {
  collectEpisodeNumbers,
  getCachedAnilistTvMedia,
  type AniListTvMedia,
} from "@/lib/anilist-tv-detail";
import {
  fetchTmdbSeasonShell,
  fetchTmdbTvShowShell,
} from "@/lib/anilist-tv-fallback";
import { buildAniListTvMediaStubFromTmdb } from "@/lib/anilist-tv-stub";
import type { Episode, SeasonDetails } from "@/lib/domain/typings";
import { getFribbAnimeList } from "@/lib/fribb-mapping";
import { getAniListTitle, type AniListMedia } from "@/lib/anilist-shared";

const buildEpisodesFromMedia = (media: SeasonEpisodeSource): Episode[] => {
  const tvMedia = media as AniListTvMedia;
  const episodeNumbers = collectEpisodeNumbers(tvMedia);
  if (episodeNumbers.length === 0) return [];

  const runtime =
    typeof tvMedia.duration === "number" && tvMedia.duration > 0
      ? tvMedia.duration
      : null;

  return episodeNumbers.map((episodeNumber) => ({
    id: tvMedia.id * 10_000 + episodeNumber,
    name:
      episodeNumbers.length === 1 && tvMedia.format === "SPECIAL"
        ? getAniListTitle(tvMedia as AniListMedia)
        : `Episode ${episodeNumber}`,
    overview: "",
    episode_number: episodeNumber,
    air_date: "",
    still_path: null,
    runtime,
    vote_average: 0,
    vote_count: 0,
    sourceAnilistId: tvMedia.id,
    sourceEpisodeNumber: episodeNumber,
  }));
};

const buildEpisodesFromSeasonIndex = async (
  tmdbShowId: number,
  seasonNumber: number,
  baseSeason: SeasonDetails,
): Promise<Episode[] | null> => {
  const indexed = await getSeasonIndexEntry({ tmdbShowId, seasonNumber });
  if (!indexed?.segments.length) {
    return null;
  }

  return buildEpisodesFromMappingSegments(indexed.segments, {
    runtime: baseSeason.episodes[0]?.runtime ?? null,
  });
};

const withTmdbEpisodeMetadata = (
  baseSeason: SeasonDetails,
  episodes: Episode[],
  tmdbZeroSeason: SeasonDetails | null,
): SeasonDetails => {
  const merged = mergeTmdbEpisodesIntoSeason(
    { ...baseSeason, episodes },
    baseSeason.episodes,
    { preserveSplitCourAppendix: true },
  );

  return {
    ...merged,
    episodes: overlayKnownTmdbZeroSeasonSpecials(
      merged.episodes,
      tmdbZeroSeason?.episodes,
    ),
  };
};

export const fetchTmdbSplitCourMergedSeasonDetails = async (
  tmdbShowId: number,
  seasonNumber: number,
): Promise<SeasonDetails | null> => {
  const fribbRows = await getFribbAnimeList();
  if (!hasFribbSplitCourForTmdbSeason(fribbRows, tmdbShowId, seasonNumber)) {
    return null;
  }

  const [baseSeason, tmdbShow, tmdbZeroSeason] = await Promise.all([
    fetchTmdbSeasonShell(tmdbShowId, seasonNumber),
    fetchTmdbTvShowShell(tmdbShowId),
    fetchTmdbSeasonShell(tmdbShowId, 0),
  ]);
  if (!baseSeason || !tmdbShow) {
    return null;
  }

  const indexedEpisodes = await buildEpisodesFromSeasonIndex(
    tmdbShowId,
    seasonNumber,
    baseSeason,
  );
  if (indexedEpisodes) {
    return withTmdbEpisodeMetadata(baseSeason, indexedEpisodes, tmdbZeroSeason);
  }

  const anilistIds = appendKnownSpecialSequelIds(
    collectFribbAnilistIdsForTmdbSeason(fribbRows, tmdbShowId, seasonNumber),
  );
  const seasonsByAnilistId = new Map<number, AniListTvMedia>();

  await Promise.all(
    anilistIds.map(async (anilistId) => {
      const media =
        (await getCachedAnilistTvMedia(anilistId)) ??
        buildAniListTvMediaStubFromTmdb(
          anilistId,
          tmdbShow,
          fribbRows.find((row) => row.anilist_id === anilistId),
        );
      seasonsByAnilistId.set(anilistId, media);
    }),
  );

  const episodes = buildMergedEpisodesForTmdbSeason({
    tmdbShowId,
    seasonNumber,
    anilistIds,
    seasonsByAnilistId,
    fribbRows,
    buildEpisodes: buildEpisodesFromMedia,
  });

  return withTmdbEpisodeMetadata(baseSeason, episodes, tmdbZeroSeason);
};
