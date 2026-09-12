import { isPlaceholderEpisodeName } from "@/lib/anime/episode-thumbnail-url";
import type { Episode, SeasonDetails } from "@/lib/domain/typings";

const hasUsableText = (value: string | null | undefined) =>
  Boolean(value?.trim());

const mergeEpisode = (
  anilistEpisode: Episode,
  tmdbEpisode: Episode,
): Episode => ({
  ...anilistEpisode,
  name:
    isPlaceholderEpisodeName(anilistEpisode.name) &&
    hasUsableText(tmdbEpisode.name) &&
    !isPlaceholderEpisodeName(tmdbEpisode.name)
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

export const mergeTmdbEpisodesIntoSeason = (
  season: SeasonDetails,
  tmdbEpisodes: Episode[] | undefined,
  options?: { preserveSplitCourAppendix?: boolean },
): SeasonDetails => {
  if (!tmdbEpisodes?.length) return season;

  const anilistByNumber = new Map(
    season.episodes.map((episode) => [episode.episode_number, episode]),
  );

  const episodes = [...tmdbEpisodes]
    .sort((left, right) => left.episode_number - right.episode_number)
    .map((tmdbEpisode) => {
      const anilistEpisode = anilistByNumber.get(tmdbEpisode.episode_number);
      return anilistEpisode
        ? mergeEpisode(anilistEpisode, tmdbEpisode)
        : tmdbEpisode;
    });

  if (!options?.preserveSplitCourAppendix) {
    return {
      ...season,
      overview: hasUsableText(season.overview)
        ? season.overview
        : (tmdbEpisodes.find((episode) => hasUsableText(episode.overview))
            ?.overview ?? season.overview),
      episodes,
    };
  }

  const maxTmdbEpisodeNumber = episodes.reduce(
    (max, episode) => Math.max(max, episode.episode_number),
    0,
  );
  const trailingAnilistEpisodes = season.episodes
    .filter((episode) => episode.episode_number > maxTmdbEpisodeNumber)
    .sort((left, right) => left.episode_number - right.episode_number);

  return {
    ...season,
    overview: hasUsableText(season.overview)
      ? season.overview
      : (tmdbEpisodes.find((episode) => hasUsableText(episode.overview))
          ?.overview ?? season.overview),
    episodes: [...episodes, ...trailingAnilistEpisodes],
  };
};
