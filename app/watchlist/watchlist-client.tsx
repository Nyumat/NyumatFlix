"use client";

import { useState, useEffect, useMemo } from "react";
import { MediaContentGrid } from "@/components/content/media-content-grid";
import { MediaItem } from "@/utils/typings";
import { WatchlistItem } from "./actions";
import { toast } from "sonner";
import { WatchlistControls, type SortOption, type MediaFilter, type TypeTab } from "@/components/watchlist/watchlist-controls";
import type { EpisodeInfo } from "@/app/watchlist/episode-check-service";
import { getTitle } from "@/utils/typings";

interface WatchlistClientProps {
  allItems: Array<MediaItem & { watchlistItem: WatchlistItem }>;
  watchlistItems: WatchlistItem[];
}

export function WatchlistClient({
  allItems,
  watchlistItems,
}: WatchlistClientProps) {
  // Control states
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("recently-watched");
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all");
  const [typeTab, setTypeTab] = useState<TypeTab>("all");

  // Episode data state
  const [episodeData, setEpisodeData] = useState<
    Record<number, EpisodeInfo>
  >({});
  const [episodeDataLoading, setEpisodeDataLoading] = useState(true);

  // Fetch episode data in background
  useEffect(() => {
    const fetchEpisodeData = async () => {
      try {
        setEpisodeDataLoading(true);
        const response = await fetch("/api/watchlist/check-episodes");
        if (response.ok) {
          const data = await response.json();
          // Convert date strings back to Date objects
          const processedData: Record<number, EpisodeInfo> = {};
          Object.entries(data.episodeData || {}).forEach(([contentId, info]: [string, any]) => {
            processedData[Number(contentId)] = {
              ...info,
              nextEpisodeDate: info.nextEpisodeDate ? new Date(info.nextEpisodeDate) : null,
              latestEpisodeAirDate: info.latestEpisodeAirDate ? new Date(info.latestEpisodeAirDate) : null,
            };
          });
          setEpisodeData(processedData);
        }
      } catch (error) {
        console.error("Error fetching episode data:", error);
        // Don't show error to user, just fail silently
      } finally {
        setEpisodeDataLoading(false);
      }
    };

    fetchEpisodeData();
  }, []);

  // Create maps for quick lookup
  const watchlistItemsMap = useMemo(() => {
    const map = new Map<number, WatchlistItem>();
    watchlistItems.forEach((item) => {
      map.set(item.contentId, item);
    });
    return map;
  }, [watchlistItems]);

  const episodeInfoMap = useMemo(() => {
    const map = new Map<number, EpisodeInfo | null>();
    Object.entries(episodeData).forEach(([contentId, info]) => {
      map.set(Number(contentId), info);
    });
    return map;
  }, [episodeData]);

  // Filter and sort items
  const filteredAndSortedItems = useMemo(() => {
    let filtered = [...allItems];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((item) => {
        const title = getTitle(item);
        return title.toLowerCase().includes(query);
      });
    }

    // Apply media type filter
    if (mediaFilter === "movies") {
      filtered = filtered.filter((item) => item.watchlistItem.mediaType === "movie");
    } else if (mediaFilter === "tv") {
      filtered = filtered.filter((item) => item.watchlistItem.mediaType === "tv");
    }

    // Apply type tab filter
    if (typeTab === "movies") {
      filtered = filtered.filter((item) => item.watchlistItem.mediaType === "movie");
    } else if (typeTab === "tv") {
      filtered = filtered.filter((item) => item.watchlistItem.mediaType === "tv");
    }

    // Note: "New Episodes Available" filter is handled in sorting logic below
    // When sort is "new-episodes", it sorts all items with new episodes first
    // but doesn't filter them out (shows all items, just sorted)

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortOption) {
        case "recently-watched": {
          const aDate = a.watchlistItem.lastWatchedAt || a.watchlistItem.createdAt;
          const bDate = b.watchlistItem.lastWatchedAt || b.watchlistItem.createdAt;
          return bDate.getTime() - aDate.getTime();
        }
        case "new-episodes": {
          // Sort by new episodes first, then by episode air date
          const aInfo = episodeData[a.id];
          const bInfo = episodeData[b.id];
          
          // Items with new episodes come first
          if (aInfo?.hasNewEpisodes && !bInfo?.hasNewEpisodes) return -1;
          if (!aInfo?.hasNewEpisodes && bInfo?.hasNewEpisodes) return 1;
          
          // If both have new episodes, sort by latest episode air date
          if (aInfo?.hasNewEpisodes && bInfo?.hasNewEpisodes) {
            const aDate = aInfo.latestEpisodeAirDate?.getTime() || 0;
            const bDate = bInfo.latestEpisodeAirDate?.getTime() || 0;
            return bDate - aDate;
          }
          
          // If neither has new episodes, sort by last watched
          const aDate = a.watchlistItem.lastWatchedAt || a.watchlistItem.createdAt;
          const bDate = b.watchlistItem.lastWatchedAt || b.watchlistItem.createdAt;
          return bDate.getTime() - aDate.getTime();
        }
        case "recently-added": {
          return b.watchlistItem.createdAt.getTime() - a.watchlistItem.createdAt.getTime();
        }
        default:
          return 0;
      }
    });

    return filtered;
  }, [allItems, searchQuery, sortOption, mediaFilter, typeTab, episodeData]);

  // Group items by status
  const watchingItems = useMemo(
    () =>
      filteredAndSortedItems.filter(
        (item) => item.watchlistItem.status === "watching",
      ),
    [filteredAndSortedItems],
  );

  const waitingItems = useMemo(
    () =>
      filteredAndSortedItems.filter(
        (item) => item.watchlistItem.status === "waiting",
      ),
    [filteredAndSortedItems],
  );

  const finishedItems = useMemo(
    () =>
      filteredAndSortedItems.filter(
        (item) => item.watchlistItem.status === "finished",
      ),
    [filteredAndSortedItems],
  );

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

      {/* Controls */}
      <WatchlistControls
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sortOption={sortOption}
        onSortChange={setSortOption}
        mediaFilter={mediaFilter}
        onMediaFilterChange={setMediaFilter}
        typeTab={typeTab}
        onTypeTabChange={setTypeTab}
      />

      {/* Sections */}
      <WatchlistSection
        title="Watching"
        items={watchingItems}
        watchlistItemsMap={watchlistItemsMap}
        episodeInfoMap={episodeInfoMap}
        onStatusChange={handleStatusChange}
      />

      <WatchlistSection
        title="Waiting for New Episodes"
        items={waitingItems}
        watchlistItemsMap={watchlistItemsMap}
        episodeInfoMap={episodeInfoMap}
        onStatusChange={handleStatusChange}
      />

      <WatchlistSection
        title="Finished"
        items={finishedItems}
        watchlistItemsMap={watchlistItemsMap}
        episodeInfoMap={episodeInfoMap}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}

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

function WatchlistSection({
  title,
  items,
  watchlistItemsMap,
  episodeInfoMap,
  onStatusChange,
}: WatchlistSectionProps) {
  // Hide section if empty (current behavior)
  if (items.length === 0) {
    return null;
  }

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
        watchlistItemsMap={watchlistItemsMap}
        onStatusChange={onStatusChange}
        episodeInfoMap={episodeInfoMap}
      />
    </section>
  );
}
