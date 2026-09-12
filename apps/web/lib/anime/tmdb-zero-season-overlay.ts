import { isPlaceholderEpisodeName } from "@/lib/anime/episode-thumbnail-url";
import { getKnownTmdbZeroSeasonSpecialRef } from "@/lib/anime/special-sequel-appendix";
import type { Episode } from "@/lib/domain/typings";

const hasUsableText = (value: string | null | undefined) =>
  Boolean(value?.trim());

const mergeSpecialEpisode = (
  anilistEpisode: Episode,
  tmdbEpisode: Episode,
): Episode => ({
  ...anilistEpisode,
  name:
    isPlaceholderEpisodeName(anilistEpisode.name) &&
    hasUsableText(tmdbEpisode.name)
      ? tmdbEpisode.name
      : anilistEpisode.name,
  overview: hasUsableText(anilistEpisode.overview)
    ? anilistEpisode.overview
    : tmdbEpisode.overview,
  still_path: tmdbEpisode.still_path ?? anilistEpisode.still_path,
  runtime: anilistEpisode.runtime ?? tmdbEpisode.runtime,
  air_date: hasUsableText(anilistEpisode.air_date)
    ? anilistEpisode.air_date
    : tmdbEpisode.air_date,
  vote_average:
    (tmdbEpisode.vote_average ?? 0) > 0
      ? tmdbEpisode.vote_average
      : anilistEpisode.vote_average,
  vote_count:
    (tmdbEpisode.vote_count ?? 0) > 0
      ? tmdbEpisode.vote_count
      : anilistEpisode.vote_count,
});

export const overlayKnownTmdbZeroSeasonSpecials = (
  episodes: Episode[],
  tmdbZeroSeasonEpisodes: Episode[] | undefined,
): Episode[] => {
  if (!tmdbZeroSeasonEpisodes?.length) {
    return episodes;
  }

  return episodes.map((episode) => {
    const sourceAnilistId = episode.sourceAnilistId;
    if (typeof sourceAnilistId !== "number") {
      return episode;
    }

    const ref = getKnownTmdbZeroSeasonSpecialRef(sourceAnilistId);
    if (!ref) {
      return episode;
    }

    const tmdbEpisode = tmdbZeroSeasonEpisodes.find(
      (candidate) => candidate.episode_number === ref.tmdbEpisode,
    );
    if (!tmdbEpisode) {
      return episode;
    }

    return mergeSpecialEpisode(episode, tmdbEpisode);
  });
};
