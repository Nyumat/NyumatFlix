/** Cross-tab signal after FFS saves so open tabs refetch `/api/site/flags`. */
export const FLAGS_UPDATED_BROADCAST_CHANNEL = "nyumatflix:site-flags-updated";

export function broadcastSiteFlagsUpdated(): void {
  if (typeof BroadcastChannel === "undefined") {
    return;
  }

  try {
    const channel = new BroadcastChannel(FLAGS_UPDATED_BROADCAST_CHANNEL);
    channel.postMessage({ type: "updated" });
    channel.close();
  } catch {
    void 0;
  }
}
