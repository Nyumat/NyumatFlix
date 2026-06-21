export interface WatchlistItem {
  id: string;
  userId: string;
  contentId: number;
  mediaType: "movie" | "tv";
  status: "watching" | "waiting" | "finished";
  lastWatchedSeason: number | null;
  lastWatchedEpisode: number | null;
  lastWatchedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
