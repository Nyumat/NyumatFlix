import type { LiveChannel } from "@/lib/live/types";

const DEFAULT_CHANNEL_QUERY = "cartoon network";

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
