"use client";

import { Loader2, RefreshCw } from "lucide-react";

import { ScrapeLoadingTips } from "@/components/media/controls/scrape-loading-tips";
import type { SourceOverlayItem } from "@/lib/scrape/source-overlay";
import { cn } from "@/lib/utils";

type ScrapingOverlayProps = {
  items: SourceOverlayItem[];
  activeProviderId: string | null;
  error?: string | null;
  className?: string;
  onSelectEmbedServer?: (serverId: string) => void;
  onSelectScrapeProvider?: (providerId: string) => void;
  onRetryAll?: () => void;
};

export function ScrapingOverlay({
  items,
  error,
  className,
  onSelectEmbedServer,
  onRetryAll,
}: ScrapingOverlayProps) {
  const availableEmbeds = items.filter(
    (item) =>
      item.kind === "embed" &&
      item.status === "available" &&
      Boolean(onSelectEmbedServer),
  );

  return (
    <div
      className={cn(
        "absolute inset-0 z-30 flex items-center justify-center bg-black px-6",
        className,
      )}
      aria-live="polite"
      aria-busy={!error}
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-8 text-center">
        {!error ? (
          <>
            <div className="flex flex-col items-center gap-3">
              <Loader2
                className="size-5 animate-spin text-white/45"
                aria-hidden
              />
              <p className="text-sm text-white/50">Finding a source…</p>
            </div>
            <ScrapeLoadingTips />
          </>
        ) : (
          <div className="flex max-w-xs flex-col items-center gap-4">
            <p className="text-sm text-white/50">{error}</p>
            {onRetryAll ? (
              <button
                type="button"
                onClick={onRetryAll}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3.5 py-1.5 text-xs font-medium text-white/75 transition-colors hover:border-white/30 hover:bg-white/6 hover:text-white"
              >
                <RefreshCw className="size-3.5" aria-hidden />
                Try again
              </button>
            ) : null}
            {availableEmbeds.length > 0 ? (
              <div className="flex flex-wrap justify-center gap-2">
                {availableEmbeds.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectEmbedServer?.(item.id)}
                    className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/45 transition-colors hover:border-white/25 hover:text-white/70"
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
