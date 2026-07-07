"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import type { SourceOverlayItem } from "@/lib/scrape/source-overlay";
import { Loader2 } from "lucide-react";

type ScrapingOverlayProps = {
  items: SourceOverlayItem[];
  activeProviderId: string | null;
  error?: string | null;
  className?: string;
  onSelectEmbedServer?: (serverId: string) => void;
};

export function ScrapingOverlay({
  items,
  activeProviderId,
  error,
  className,
  onSelectEmbedServer,
}: ScrapingOverlayProps) {
  const [isTakingLonger, setIsTakingLonger] = useState(false);
  const activeItem = items.find(
    (item) => item.kind === "scrape" && item.id === activeProviderId,
  );
  const availableEmbeds = items.filter(
    (item) =>
      item.kind === "embed" &&
      item.status === "available" &&
      Boolean(onSelectEmbedServer),
  );

  useEffect(() => {
    setIsTakingLonger(false);
    if (error) return;

    const timeout = window.setTimeout(() => setIsTakingLonger(true), 4000);
    return () => window.clearTimeout(timeout);
  }, [activeProviderId, error]);

  return (
    <div
      className={cn(
        "absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-md",
        className,
      )}
    >
      <div className="w-full max-w-sm px-6">
        <div className="rounded-2xl border border-white/10 bg-zinc-950/90 px-6 py-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          {error ? (
            <div className="space-y-4 text-center">
              <p className="text-sm leading-relaxed text-white/65">{error}</p>
              {availableEmbeds.length > 0 ? (
                <div className="flex flex-wrap justify-center gap-2">
                  {availableEmbeds.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectEmbedServer?.(item.id)}
                      className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs text-white/80 transition hover:border-white/25 hover:bg-white/10"
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <Loader2
                className="size-5 animate-spin text-white/55"
                aria-hidden
              />
              <div className="text-center">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/40">
                  {isTakingLonger
                    ? "Trying another source…"
                    : "Finding a working source…"}
                </p>
                <p className="mt-1.5 text-lg font-medium tracking-tight text-white">
                  {activeItem?.name ?? "Starting…"}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
