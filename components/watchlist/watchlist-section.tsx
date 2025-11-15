"use client";

import { useState, useEffect } from "react";
import { MediaContentGrid } from "@/components/content/media-content-grid";
import { MediaItem } from "@/utils/typings";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { getUserWatchlist } from "@/app/watchlist/actions";
import { WatchlistItem } from "@/app/watchlist/actions";

interface WatchlistSectionProps {
  status: "watching" | "waiting" | "finished";
  items: MediaItem[];
  watchlistItems: WatchlistItem[];
  onStatusChange: (
    itemId: string,
    newStatus: "watching" | "waiting" | "finished",
  ) => void;
}

export function WatchlistSection({
  status,
  items,
  watchlistItems,
  onStatusChange,
}: WatchlistSectionProps) {
  const statusLabels = {
    watching: "Watching",
    waiting: "Waiting for New Episodes",
    finished: "Finished",
  };

  if (items.length === 0) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">
          {statusLabels[status]}
        </h2>
        <div className="text-center py-12 text-muted-foreground">
          <p>No items in this section</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold text-foreground">
        {statusLabels[status]}
      </h2>
      <MediaContentGrid
        items={items}
        defaultViewMode="grid"
        showViewModeControls={true}
        showDock={false}
      />
    </section>
  );
}

interface WatchlistItemCardProps {
  item: MediaItem;
  watchlistItem: WatchlistItem;
  onStatusChange: (newStatus: "watching" | "waiting" | "finished") => void;
}

export function WatchlistItemCard({
  item,
  watchlistItem,
  onStatusChange,
}: WatchlistItemCardProps) {
  return (
    <div className="relative group">
      <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <ToggleGroup
          type="single"
          value={watchlistItem.status}
          onValueChange={(value) => {
            if (
              value &&
              (value === "watching" ||
                value === "waiting" ||
                value === "finished")
            ) {
              onStatusChange(value);
            }
          }}
          className="bg-background/90 backdrop-blur-md border border-border rounded-md p-1"
        >
          <ToggleGroupItem
            value="watching"
            aria-label="Watching"
            size="sm"
            className={cn(
              "px-2 py-1 text-xs",
              watchlistItem.status === "watching" &&
                "bg-primary text-primary-foreground",
            )}
          >
            Watching
          </ToggleGroupItem>
          <ToggleGroupItem
            value="waiting"
            aria-label="Waiting"
            size="sm"
            className={cn(
              "px-2 py-1 text-xs",
              watchlistItem.status === "waiting" &&
                "bg-primary text-primary-foreground",
            )}
          >
            Waiting
          </ToggleGroupItem>
          <ToggleGroupItem
            value="finished"
            aria-label="Finished"
            size="sm"
            className={cn(
              "px-2 py-1 text-xs",
              watchlistItem.status === "finished" &&
                "bg-primary text-primary-foreground",
            )}
          >
            Finished
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  );
}
