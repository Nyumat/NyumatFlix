import type { MegaplayPlaybackRefresh } from "./megaplay-constants";
import type { VidKingPlaybackRefresh } from "./vidking-constants";
import type { VidsrcPlaybackRefresh } from "./vidsrc-constants";
import type { VixsrcPlaybackRefresh } from "./vixsrc-constants";

export type ScrapePlaybackRefresh =
  | VidKingPlaybackRefresh
  | VidsrcPlaybackRefresh
  | VixsrcPlaybackRefresh
  | MegaplayPlaybackRefresh;

export const isVidsrcPlaybackRefresh = (
  refresh: ScrapePlaybackRefresh | undefined,
): refresh is VidsrcPlaybackRefresh =>
  refresh?.providerId === "vidsrc" || refresh?.providerId === "vidsrc-mirror";

export const isVidKingPlaybackRefresh = (
  refresh: ScrapePlaybackRefresh | undefined,
): refresh is VidKingPlaybackRefresh => refresh?.providerId === "vidking";

export const isVixsrcPlaybackRefresh = (
  refresh: ScrapePlaybackRefresh | undefined,
): refresh is VixsrcPlaybackRefresh => refresh?.providerId === "vixsrc";

export const isMegaplayPlaybackRefresh = (
  refresh: ScrapePlaybackRefresh | undefined,
): refresh is MegaplayPlaybackRefresh => refresh?.providerId === "megaplay";
