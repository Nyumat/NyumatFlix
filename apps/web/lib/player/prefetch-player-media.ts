import { resolveMoviMediaUrl } from "@/lib/player/load-player";

const MOVI_PREFETCH_BYTES = 1024 * 1024;
const MOVI_PREFETCH_TIMEOUT_MS = 15_000;

const prefetched = new Set<string>();

/** Warm the first megabyte of a direct file so movi demux starts faster. */
export function prefetchMoviMediaBytes(src: string): void {
  if (typeof window === "undefined" || !src) {
    return;
  }

  const url = resolveMoviMediaUrl(src);
  if (prefetched.has(url)) {
    return;
  }
  prefetched.add(url);

  void fetch(url, {
    method: "GET",
    headers: { Range: `bytes=0-${MOVI_PREFETCH_BYTES - 1}` },
    signal: AbortSignal.timeout(MOVI_PREFETCH_TIMEOUT_MS),
  })
    .then((response) => response.body?.cancel().catch(() => undefined))
    .catch(() => {
      prefetched.delete(url);
    });
}
