import type { Episode } from "@/lib/domain/typings";

export type PlaybackTitleInput = {
  showTitle: string;
  mediaType?: "tv" | "movie";
  seasonNumber?: number | null;
  episode?: Episode | null;
};

/** Vidstack player title: show name, or show + S#E# + episode name for TV/anime. */
export function formatPlaybackTitle({
  showTitle,
  mediaType,
  seasonNumber,
  episode,
}: PlaybackTitleInput): string {
  const base = showTitle.trim() || "Now playing";

  if (
    mediaType !== "tv" ||
    seasonNumber == null ||
    seasonNumber <= 0 ||
    !episode
  ) {
    return base;
  }

  const episodeCode = `S${seasonNumber}E${episode.episode_number}`;
  const episodeName = episode.name?.trim();

  if (episodeName) {
    return `${base} · ${episodeCode} · ${episodeName}`;
  }

  return `${base} · ${episodeCode}`;
}
