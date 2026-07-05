"use client";

import { cn } from "@/lib/utils";
import type { SourceOverlayItem } from "@/lib/scrape/source-overlay";
import { Check, Loader2, Minus, X } from "lucide-react";

type ScrapingOverlayProps = {
  items: SourceOverlayItem[];
  activeProviderId: string | null;
  error?: string | null;
  className?: string;
  onSelectEmbedServer?: (serverId: string) => void;
};

const statusIcon = (item: SourceOverlayItem) => {
  switch (item.status) {
    case "pending":
      return <Loader2 className="size-4 animate-spin text-white" />;
    case "success":
    case "available":
      return <Check className="size-4 text-white/80" strokeWidth={2} />;
    case "failure":
    case "unavailable":
      return <X className="size-4 text-white/50" strokeWidth={2} />;
    case "skipped":
      return <Minus className="size-4 text-white/30" strokeWidth={2} />;
    case "waiting":
    case "unknown":
      return <span className="size-1.5 rounded-full bg-white/25" />;
    default:
      return <span className="size-1.5 rounded-full bg-white/25" />;
  }
};

export function ScrapingOverlay({
  items,
  activeProviderId,
  error,
  className,
  onSelectEmbedServer,
}: ScrapingOverlayProps) {
  return (
    <div
      className={cn(
        "absolute inset-0 z-30 flex items-center justify-center",
        className,
      )}
    >
      <ul className="w-full max-w-sm space-y-1 px-4">
        {items.map((item) => {
          const isActive =
            item.kind === "scrape" && item.id === activeProviderId;
          const isSelectableEmbed =
            item.kind === "embed" &&
            item.status === "available" &&
            Boolean(onSelectEmbedServer);
          const isUnavailableEmbed =
            item.kind === "embed" && item.status === "unavailable";

          return (
            <li
              key={`${item.kind}-${item.id}`}
              className={cn(
                "rounded-md px-3 py-2",
                isActive && "bg-black/35",
                item.status === "skipped" && "opacity-40",
                item.status === "failure" && !isActive && "opacity-50",
                isUnavailableEmbed && "opacity-45",
                isSelectableEmbed &&
                  "cursor-pointer transition hover:bg-black/30",
              )}
            >
              {isSelectableEmbed ? (
                <button
                  type="button"
                  onClick={() => onSelectEmbedServer?.(item.id)}
                  className="flex w-full items-center gap-3 text-left"
                >
                  <div className="flex size-5 shrink-0 items-center justify-center">
                    {statusIcon(item)}
                  </div>
                  <p className="min-w-0 flex-1 truncate text-sm text-white/85">
                    {item.name}
                  </p>
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex size-5 shrink-0 items-center justify-center">
                    {statusIcon(item)}
                  </div>
                  <p
                    className={cn(
                      "min-w-0 flex-1 truncate text-sm",
                      isActive ? "text-white" : "text-white/70",
                    )}
                  >
                    {item.name}
                  </p>
                </div>
              )}
              {item.status === "failure" && item.error ? (
                <p
                  className="mt-0.5 truncate pl-8 text-xs text-white/40"
                  title={item.error}
                >
                  {item.error}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>

      {error ? (
        <p className="absolute inset-x-0 bottom-6 px-6 text-center text-sm text-white/60">
          {error}
        </p>
      ) : null}
    </div>
  );
}
