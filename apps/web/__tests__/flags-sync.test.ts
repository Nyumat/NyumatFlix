import { describe, expect, it, vi } from "vitest";

import {
  broadcastSiteFlagsUpdated,
  FLAGS_UPDATED_BROADCAST_CHANNEL,
} from "@/lib/flags/flags-sync";

describe("flags-sync", () => {
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
