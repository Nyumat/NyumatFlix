import type { WatchlistStatus } from "@/lib/domain/watchlist";
import type { MalListStatus } from "./constants";

export type MalWatchlistSectionId = MalListStatus;

/**
 * Local watchlist status mirrors MAL 1:1, so each section id doubles as the
 * local `WatchlistStatus` value driving that accordion section.
 */
export const MAL_WATCHLIST_SECTIONS: Array<{
  id: MalWatchlistSectionId;
  title: string;
  status: WatchlistStatus;
}> = [
  { id: "watching", title: "Watching", status: "watching" },
  { id: "completed", title: "Completed", status: "completed" },
  { id: "on_hold", title: "On-Hold", status: "on_hold" },
  { id: "dropped", title: "Dropped", status: "dropped" },
  { id: "plan_to_watch", title: "Plan to Watch", status: "plan_to_watch" },
];
