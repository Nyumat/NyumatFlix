export type EpisodeCoordinates = {
  seasonNumber: number;
  episodeNumber: number;
};

export interface EpisodeInfo {
  hasNewEpisodes: boolean;
  newEpisodeCount: number;
  hasUnwatchedEpisodes: boolean;
  unwatchedEpisodeCount: number;
  nextUnwatchedEpisode: EpisodeCoordinates | null;
  nextEpisodeDate: Date | null;
  countdown: string | null;
  latestEpisodeAirDate: Date | null;
}
