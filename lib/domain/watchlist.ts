export type WatchlistStatus =
  | "watching"
  | "plan_to_watch"
  | "on_hold"
  | "dropped"
  | "completed";

export interface WatchlistItem {
  id: string;
  userId: string;
  contentId: number;
  mediaType: "movie" | "tv";
  status: WatchlistStatus;
  lastWatchedSeason: number | null;
  lastWatchedEpisode: number | null;
  lastWatchedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
