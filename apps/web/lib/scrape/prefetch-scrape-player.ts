import { loadMoviCompat } from "@/lib/player/load-player";

/** Warm Movi WASM while scrape races run. */
export function prefetchMoviScrapePlayer(): void {
  if (typeof window === "undefined") {
    return;
  }

  void loadMoviCompat().catch(() => undefined);
}
