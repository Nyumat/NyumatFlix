import type { PlayerSrc } from "@vidstack/react";

export type ScrapeStreamKind = "hls" | "dash" | "mp4";

export const buildScrapeMediaPlayerSrc = (
  playUrl: string,
  streamKind: ScrapeStreamKind = "hls",
): PlayerSrc => {
  switch (streamKind) {
    case "dash":
      return { src: playUrl, type: "application/dash+xml" };
    case "mp4":
      return { src: playUrl, type: "video/mp4" };
    default:
      return playUrl;
  }
};
