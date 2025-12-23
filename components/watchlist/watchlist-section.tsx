"use client";

import { MediaContentGrid } from "@/components/content/media-content-grid";
import { MediaItem } from "@/utils/typings";
import { WatchlistItem } from "@/app/watchlist/actions";
import { EpisodeInfo } from "@/app/watchlist/episode-check-service";

interface WatchlistSectionProps {
  title: string;
  items: Array<MediaItem & { watchlistItem: WatchlistItem }>;
  watchlistItemsMap: Map<number, WatchlistItem>;
  episodeInfoMap: Map<number, EpisodeInfo | null>;
  onStatusChange: (
    itemId: string,
    newStatus: "watching" | "waiting" | "finished",
  ) => void;
}

export function WatchlistSection({
  title,
  items,
  watchlistItemsMap,
  episodeInfoMap,
  onStatusChange,
}: WatchlistSectionProps) {
  // If no items, don't render the section (cleaner UI)
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4 animate-in fade-in duration-500">
      <div className="flex items-center justify-between border-b border-border/40 pb-2">
        <h2 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          {title}
          <span className="text-sm font-normal text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
            {items.length}
          </span>
        </h2>
      </div>
      <MediaContentGrid
        items={items}
        defaultViewMode="grid"
        showViewModeControls={true}
        showDock={false}
        watchlistItemsMap={watchlistItemsMap}
        onStatusChange={onStatusChange}
        episodeInfoMap={episodeInfoMap}
      />
    </section>
  );
}
