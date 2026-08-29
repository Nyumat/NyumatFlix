import { engineSourceUrl, selectInitialEngine } from "@/lib/direct/playback";
import type { DirectStream } from "@/lib/direct/types";
import { loadMoviPlayer } from "@/lib/movi/load-movi-player";

const DIRECT_MP4_PREFETCH_BYTES = 65_535;

export function prefetchDirectPlayback(stream: DirectStream): void {
  if (typeof window === "undefined") {
    return;
  }

  const engine = selectInitialEngine(stream);
  if (!engine) {
    return;
  }

  if (engine === "movi") {
    void loadMoviPlayer();
  }

  const sourceUrl = engineSourceUrl(stream, engine);

  if (engine === "vidstack-direct") {
    void fetch(sourceUrl, {
      headers: { Range: `bytes=0-${DIRECT_MP4_PREFETCH_BYTES}` },
    }).catch(() => undefined);
    return;
  }

  if (engine === "vidstack-hls") {
    void fetch(sourceUrl, {
      headers: { Accept: "application/vnd.apple.mpegurl" },
    }).catch(() => undefined);
  }
}
