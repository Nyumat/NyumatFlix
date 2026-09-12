import type { EpisodeInfo } from "@/lib/domain/episodes";
import type { BecauseYouWatchedResult } from "@/lib/personalization/because-you-watched";
import type { RecentlyWatchedItem } from "@/lib/playback/recently-watched";

export type SerializedEpisodeInfo = Omit<
  EpisodeInfo,
  "nextEpisodeDate" | "latestEpisodeAirDate"
> & {
  nextEpisodeDate: string | null;
  latestEpisodeAirDate: string | null;
};

export type PersonalizedUpNextItemWire = RecentlyWatchedItem & {
  episodeInfo: SerializedEpisodeInfo;
  upNextHref: string;
};

export type PersonalizedUpNextItem = RecentlyWatchedItem & {
  episodeInfo: EpisodeInfo;
  upNextHref: string;
};

export type PersonalizedHomeResponseWire = {
  recentlyWatched: RecentlyWatchedItem[];
  upNext: PersonalizedUpNextItemWire[];
  becauseYouWatched: BecauseYouWatchedResult | null;
};

export type PersonalizedHomeData = {
  recentlyWatched: RecentlyWatchedItem[];
  upNext: PersonalizedUpNextItem[];
  becauseYouWatched: BecauseYouWatchedResult | null;
};

export const serializeEpisodeInfo = (
  info: EpisodeInfo,
): SerializedEpisodeInfo => ({
  ...info,
  nextEpisodeDate: info.nextEpisodeDate?.toISOString() ?? null,
  latestEpisodeAirDate: info.latestEpisodeAirDate?.toISOString() ?? null,
});

const deserializeEpisodeInfo = (
  serialized: SerializedEpisodeInfo,
): EpisodeInfo => ({
  ...serialized,
  nextEpisodeDate: serialized.nextEpisodeDate
    ? new Date(serialized.nextEpisodeDate)
    : null,
  latestEpisodeAirDate: serialized.latestEpisodeAirDate
    ? new Date(serialized.latestEpisodeAirDate)
    : null,
});

export const parsePersonalizedHomeResponse = (
  wire: PersonalizedHomeResponseWire,
): PersonalizedHomeData => ({
  recentlyWatched: wire.recentlyWatched,
  upNext: wire.upNext.map((item) => ({
    ...item,
    episodeInfo: deserializeEpisodeInfo(item.episodeInfo),
  })),
  becauseYouWatched: wire.becauseYouWatched,
});
