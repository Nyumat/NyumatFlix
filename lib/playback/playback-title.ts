import type { Episode } from "@/lib/domain/typings";

export type PlaybackTitleInput = {
  showTitle: string;
  mediaType?: "tv" | "movie";
  seasonNumber?: number | null;
  episode?: Episode | null;
  /** Prefer AniList-segment display coords when TMDB collapses cours. */
  displaySeasonNumber?: number | null;
  displayEpisodeNumber?: number | null;
};

/** Vidstack player title: show name, or show + S#E# + episode name for TV/anime. */
export function formatPlaybackTitle({
  showTitle,
  mediaType,
  seasonNumber,
  episode,
  displaySeasonNumber,
  displayEpisodeNumber,
}: PlaybackTitleInput): string {
  const base = showTitle.trim() || "Now playing";

  const resolvedSeason = displaySeasonNumber ?? seasonNumber;
  const resolvedEpisode =
    displayEpisodeNumber ?? episode?.episode_number ?? null;

  if (
    mediaType !== "tv" ||
    resolvedSeason == null ||
    resolvedSeason <= 0 ||
    !episode ||
    resolvedEpisode == null
  ) {
    return base;
  }

  const episodeCode = `S${resolvedSeason}E${resolvedEpisode}`;
  const episodeName = episode.name?.trim();

  if (episodeName) {
    return `${base} · ${episodeCode} · ${episodeName}`;
  }

  return `${base} · ${episodeCode}`;
}
