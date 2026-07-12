"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

import { ScrapeSourceRow } from "@/components/media/controls/scrape-card";
import { buttonVariants } from "@/components/ui/button";
import type { SourceOverlayItem } from "@/lib/scrape/source-overlay";
import type { ScrapeItem, ScrapeItemStatus } from "@/lib/scrape/types";
import { cn } from "@/lib/utils";

const SCRAPE_TIPS = [
  "Sources are tried one at a time until a stream is found.",
  "Your last working source is remembered for this title.",
  "Failed sources are skipped automatically on retry.",
  "You can pick a specific source from the server menu.",
  "Embed servers are available if direct scraping fails.",
  "Playback issues will try the next source in the list.",
  "Popular titles often resolve on the first source.",
  "Switch servers anytime from the player controls.",
] as const;

const TIP_ROTATE_MS = 4200;

type ScrapingOverlayProps = {
  items: SourceOverlayItem[];
  activeProviderId: string | null;
  error?: string | null;
  className?: string;
  onSelectEmbedServer?: (serverId: string) => void;
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

function useRotatingTip(paused: boolean) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (paused) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setIndex((current) => (current + 1) % SCRAPE_TIPS.length);
    }, TIP_ROTATE_MS);

    return () => window.clearInterval(intervalId);
  }, [paused]);

  return SCRAPE_TIPS[index]!;
}

export function ScrapingOverlay({
  items,
  activeProviderId,
  error,
  className,
  onSelectEmbedServer,
}: ScrapingOverlayProps) {
  const scrapeItems = useMemo(() => toScrapeItems(items), [items]);
  const availableEmbeds = items.filter(
    (item) =>
      item.kind === "embed" &&
      item.status === "available" &&
      Boolean(onSelectEmbedServer),
  );

  const listRef = useRef<HTMLDivElement | null>(null);
  const activeRowRef = useRef<HTMLDivElement | null>(null);
  const tip = useRotatingTip(Boolean(error));

  useEffect(() => {
    activeRowRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [activeProviderId]);

  const settledCount = scrapeItems.filter(
    (item) => item.status !== "waiting" && item.status !== "pending",
  ).length;
  const activeIndex = scrapeItems.findIndex(
    (item) => item.providerId === activeProviderId,
  );
  const progressCount = Math.max(settledCount, activeIndex + 1);
  const total = scrapeItems.length;
  const progressFraction = total > 0 ? progressCount / total : 0;

  return (
    <div
      className={cn(
        "absolute inset-0 z-30 flex items-center justify-center bg-black/60 p-6 backdrop-blur-md",
        className,
      )}
    >
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 340, damping: 30 }}
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/90 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl"
      >
        <div className="flex items-center justify-between px-5 pt-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
            {error ? "No source found" : "Finding a stream"}
          </p>
          {!error && total > 0 ? (
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-medium tabular-nums text-white/45">
              {Math.min(progressCount, total)}/{total}
            </span>
          ) : null}
        </div>

        {!error ? (
          <div className="mx-5 mt-3 h-1 overflow-hidden rounded-full bg-white/5">
            <motion.div
              className="h-full rounded-full bg-[#D247BF]"
              animate={{ width: `${Math.min(100, progressFraction * 100)}%` }}
              transition={{ type: "spring", stiffness: 120, damping: 24 }}
            />
          </div>
        ) : null}

        <div
          ref={listRef}
          className="scrollbar-hidden mt-3 max-h-72 space-y-0.5 overflow-y-auto px-3 py-2"
        >
          <AnimatePresence initial={false}>
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
          </AnimatePresence>
        </div>

        <div className="border-t border-white/5 px-5 py-4">
          {error ? (
            <div className="space-y-3">
              <p className="text-center text-sm leading-relaxed text-white/60">
                {error}
              </p>
              {availableEmbeds.length > 0 ? (
                <div className="flex flex-wrap justify-center gap-2 pt-1">
                  {availableEmbeds.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectEmbedServer?.(item.id)}
                      className={cn(
                        buttonVariants({ variant: "chrome", size: "sm" }),
                        "h-8 rounded-full px-3 text-xs",
                      )}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.p
                key={tip}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.25 }}
                className="text-center text-xs text-white/35"
              >
                {tip}
              </motion.p>
            </AnimatePresence>
          )}
        </div>
      </motion.div>
    </div>
  );
}
