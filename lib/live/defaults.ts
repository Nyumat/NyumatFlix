import type { LiveChannel } from "@/lib/live/types";

const DEFAULT_CHANNEL_QUERY = "anime x hidive";

export const FEATURED_CHANNEL_QUERIES = [DEFAULT_CHANNEL_QUERY] as const;

export const isFeaturedLiveChannel = (channel: LiveChannel) =>
  FEATURED_CHANNEL_QUERIES.some((query) =>
    channel.name.toLowerCase().includes(query),
  );

export const sortFeaturedLiveChannelsFirst = (channels: LiveChannel[]) => {
  const featured = channels.filter(isFeaturedLiveChannel);
  const rest = channels.filter((channel) => !isFeaturedLiveChannel(channel));

  return [...featured, ...rest];
};

export const pickDefaultLiveChannel = (
  channels: LiveChannel[],
): LiveChannel | null => {
  const preferred = channels.find(
    (channel) =>
      channel.playUrl &&
      channel.name.toLowerCase().includes(DEFAULT_CHANNEL_QUERY),
  );

  return preferred ?? channels.find((channel) => channel.playUrl) ?? null;
};
