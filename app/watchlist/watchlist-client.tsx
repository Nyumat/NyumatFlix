"use client";

import { useState } from "react";
import { MediaContentGrid } from "@/components/content/media-content-grid";
import { MediaItem } from "@/utils/typings";
import { WatchlistItem } from "./actions";
import { toast } from "sonner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

interface WatchlistClientProps {
  watchingItems: Array<MediaItem & { watchlistItem: WatchlistItem }>;
  waitingItems: Array<MediaItem & { watchlistItem: WatchlistItem }>;
  finishedItems: Array<MediaItem & { watchlistItem: WatchlistItem }>;
  watchlistItems: WatchlistItem[];
}

export function WatchlistClient({
  watchingItems,
  waitingItems,
  finishedItems,
  watchlistItems,
}: WatchlistClientProps) {
  const handleStatusChange = async (
    itemId: string,
    newStatus: "watching" | "waiting" | "finished",
  ) => {
    try {
      const response = await fetch(`/api/watchlist/${itemId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: newStatus,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update status");
      }

      toast.success("Status updated");
      // Refresh the page to show updated status
      window.location.reload();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  };

  return (
    <div className="container mx-auto px-4 pt-24 pb-8 space-y-12">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold text-foreground">My Watchlist</h1>
        <p className="text-muted-foreground">
          Track your viewing progress and manage your watchlist
        </p>
      </div>

      <WatchlistSection
        title="Watching"
        items={watchingItems}
        watchlistItems={watchlistItems}
        onStatusChange={handleStatusChange}
      />

      <WatchlistSection
        title="Waiting for New Episodes"
        items={waitingItems}
        watchlistItems={watchlistItems}
        onStatusChange={handleStatusChange}
      />

      <WatchlistSection
        title="Finished"
        items={finishedItems}
        watchlistItems={watchlistItems}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}

interface WatchlistSectionProps {
  title: string;
  items: Array<MediaItem & { watchlistItem: WatchlistItem }>;
  watchlistItems: WatchlistItem[];
  onStatusChange: (itemId: string, newStatus: "watching" | "waiting" | "finished") => void;
}

function WatchlistSection({
  title,
  items,
  watchlistItems,
  onStatusChange,
}: WatchlistSectionProps) {
  if (items.length === 0) {
    return null;
  }

  // Create a map for quick lookup
  const watchlistMap = new Map(
    watchlistItems.map((item) => [item.id, item]),
  );

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
        <span className="text-sm text-muted-foreground">
          {items.length} {items.length === 1 ? "item" : "items"}
        </span>
      </div>
      <MediaContentGrid
        items={items}
        defaultViewMode="grid"
        showViewModeControls={true}
        showDock={false}
      />
    </section>
  );
}

