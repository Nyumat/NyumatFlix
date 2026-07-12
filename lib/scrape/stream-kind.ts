import type { PlayerSrc } from "@vidstack/react";

export type ScrapeStreamKind = "hls" | "dash" | "mp4";

/** Infer kind from proxied play URL when the scrape payload omits streamKind. */
export const inferScrapeStreamKind = (
  playUrl: string,
  explicit?: ScrapeStreamKind | null,
): ScrapeStreamKind => {
  if (explicit === "dash" || explicit === "mp4" || explicit === "hls") {
    return explicit;
  }

  if (
    /\/asset\.mpd(?:[?#]|$)/i.test(playUrl) ||
    /\.mpd(?:[?#]|$)/i.test(playUrl)
  ) {
    return "dash";
  }

  if (
    /\/asset\.mp4(?:[?#]|$)/i.test(playUrl) ||
    /\.mp4(?:[?#]|$)/i.test(playUrl)
  ) {
    return "mp4";
  }

  return "hls";
};

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
