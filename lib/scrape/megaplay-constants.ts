export type MegaplayPlaybackRefresh = {
  providerId: "megaplay";
  referer: string;
  /** Master URL from scrape — only this path gets re-fetched at play time. */
  seedStreamUrl: string;
  /** AnimePahe / direct Megaplay embed — refresh via getSources. */
  megaplayId?: string;
  /** JustAnime Megaplay API track — refresh via episode megaplay endpoint. */
  justanime?: {
    anilistId: number;
    episodeNumber: number;
    translationType?: "sub" | "dub";
  };
};
