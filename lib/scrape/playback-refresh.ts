import type { VidKingPlaybackRefresh } from "./vidking-constants";
import type { VidsrcPlaybackRefresh } from "./vidsrc-constants";

export type ScrapePlaybackRefresh =
  | VidKingPlaybackRefresh
  | VidsrcPlaybackRefresh;

export const isVidsrcPlaybackRefresh = (
  refresh: ScrapePlaybackRefresh | undefined,
): refresh is VidsrcPlaybackRefresh =>
  refresh?.providerId === "vidsrc" || refresh?.providerId === "vidsrc-mirror";

export const isVidKingPlaybackRefresh = (
  refresh: ScrapePlaybackRefresh | undefined,
): refresh is VidKingPlaybackRefresh => refresh?.providerId === "vidking";
