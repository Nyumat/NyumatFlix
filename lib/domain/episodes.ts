export interface EpisodeInfo {
  hasNewEpisodes: boolean;
  newEpisodeCount: number;
  nextEpisodeDate: Date | null;
  countdown: string | null;
  latestEpisodeAirDate: Date | null;
}
