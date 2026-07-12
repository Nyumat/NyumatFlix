"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

import { ScrapeSourceRow } from "@/components/media/controls/scrape-card";
import { ScrapeLoadingTips } from "@/components/media/controls/scrape-loading-tips";
import type { SourceOverlayItem } from "@/lib/scrape/source-overlay";
import type { ScrapeItem, ScrapeItemStatus } from "@/lib/scrape/types";
import { cn } from "@/lib/utils";

type ScrapingOverlayProps = {
  items: SourceOverlayItem[];
  activeProviderId: string | null;
  error?: string | null;
  className?: string;
  onSelectEmbedServer?: (serverId: string) => void;
  onRetryAll?: () => void;
};

function toScrapeItems(items: SourceOverlayItem[]): ScrapeItem[] {
  return items
    .filter((item) => item.kind === "scrape")
    .map((item) => ({
      providerId: item.id,
      name: item.name,
      status: item.status as ScrapeItemStatus,
      error: item.error,
    }));
}

export function ScrapingOverlay({
  items,
  activeProviderId,
  error,
  className,
  onSelectEmbedServer,
  onRetryAll,
}: ScrapingOverlayProps) {
  const scrapeItems = useMemo(() => toScrapeItems(items), [items]);
  const availableEmbeds = items.filter(
    (item) =>
      item.kind === "embed" &&
      item.status === "available" &&
      Boolean(onSelectEmbedServer),
  );

  const activeRowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    activeRowRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [activeProviderId]);

  return (
    <div
      className={cn(
        "absolute inset-0 z-30 flex items-center justify-center bg-black px-6",
        className,
      )}
    >
      <div className="flex w-full max-w-sm flex-col items-center">
        <div className="max-h-80 w-full space-y-1 overflow-y-auto scrollbar-hidden">
          <div className="mx-auto flex w-fit flex-col">
            {scrapeItems.map((item) => {
              const isActive = item.providerId === activeProviderId;
              return (
                <div
                  key={item.providerId}
                  ref={isActive ? activeRowRef : undefined}
                >
                  <ScrapeSourceRow
                    id={item.providerId}
                    name={item.name}
                    status={item.status}
                    error={item.error}
                    active={isActive}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {!error ? <ScrapeLoadingTips /> : null}

        {error ? (
          <div className="mt-8 flex w-full flex-col items-center gap-4 text-center">
            <p className="max-w-xs text-base text-white/55">{error}</p>
            {onRetryAll ? (
              <button
                type="button"
                onClick={onRetryAll}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/8 px-4 py-2 text-sm font-medium text-white/85 transition-colors hover:border-white/35 hover:bg-white/12 hover:text-white"
              >
                <RefreshCw className="h-4 w-4" aria-hidden />
                Try all sources again
              </button>
            ) : null}
            {availableEmbeds.length > 0 ? (
              <div className="flex flex-wrap justify-center gap-2">
                {availableEmbeds.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectEmbedServer?.(item.id)}
                    className="rounded-full border border-white/15 px-3 py-1.5 text-sm text-white/60 transition-colors hover:border-white/30 hover:text-white/80"
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
