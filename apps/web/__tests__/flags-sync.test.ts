import { describe, expect, it, vi } from "vitest";

import {
  broadcastSiteFlagsUpdated,
  FLAGS_UPDATED_BROADCAST_CHANNEL,
  SITE_FLAGS_REVALIDATE_TAG,
} from "@/lib/flags/flags-sync";

describe("flags-sync", () => {
  it("exports the revalidate tag used by site flags cache", () => {
    expect(SITE_FLAGS_REVALIDATE_TAG).toBe("site-flags-public");
  });

  it("broadcasts a save event to other tabs", () => {
    const postMessage = vi.fn();
    const close = vi.fn();

    class MockBroadcastChannel {
      onmessage: ((event: MessageEvent) => void) | null = null;

      constructor(public readonly name: string) {
        expect(name).toBe(FLAGS_UPDATED_BROADCAST_CHANNEL);
      }

      postMessage = postMessage;
      close = close;
    }

    vi.stubGlobal("BroadcastChannel", MockBroadcastChannel);

    broadcastSiteFlagsUpdated();

    expect(postMessage).toHaveBeenCalledWith({ type: "updated" });
    expect(close).toHaveBeenCalledOnce();
  });
});
