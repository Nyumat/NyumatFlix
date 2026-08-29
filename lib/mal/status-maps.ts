/**
 * Pure status mapping helpers — safe for client and server bundles.
 *
 * The local watchlist status is a 1:1 mirror of MAL's five list statuses, so
 * these mappings are a lossless bijection in both directions.
 */

import type { WatchlistStatus } from "@/lib/domain/watchlist";
import type { MalListStatus } from "./constants";

export function mapMalStatusToWatchlistStatus(
  malStatus?: string,
): WatchlistStatus {
  switch (malStatus) {
    case "completed":
      return "completed";
    case "plan_to_watch":
      return "plan_to_watch";
    case "on_hold":
      return "on_hold";
    case "dropped":
      return "dropped";
    case "watching":
    default:
      return "watching";
  }
}

export function mapWatchlistStatusToMalStatus(
  status: WatchlistStatus,
): MalListStatus {
  switch (status) {
    case "completed":
      return "completed";
    case "plan_to_watch":
      return "plan_to_watch";
    case "on_hold":
      return "on_hold";
    case "dropped":
      return "dropped";
    case "watching":
    default:
      return "watching";
  }
}
