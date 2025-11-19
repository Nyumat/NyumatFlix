"use client";

import { useState, useEffect, useMemo } from "react";
import { MediaItem } from "@/utils/typings";
import { WatchlistItem } from "./actions";
import { toast } from "sonner";
import {
  WatchlistControls,
  type SortOption,
  type StatusFilter,
  type TypeTab,
} from "@/components/watchlist/watchlist-controls";
import type { EpisodeInfo } from "@/app/watchlist/episode-check-service";
import { getTitle } from "@/utils/typings";
import { WatchlistSection } from "@/components/watchlist/watchlist-section";
import Link from "next/link";
import { Film, Tv } from "lucide-react";

interface WatchlistClientProps {
  allItems: Array<MediaItem & { watchlistItem: WatchlistItem }>;
  watchlistItems: WatchlistItem[];
}

export function WatchlistClient({
  allItems: initialAllItems,
  watchlistItems: initialWatchlistItems,
}: WatchlistClientProps) {
  // State for items to handle optimistic updates
  const [allItems, setAllItems] = useState(initialAllItems);
  const [watchlistItems, setWatchlistItems] = useState(initialWatchlistItems);

  // Control states
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("recently-watched");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeTab, setTypeTab] = useState<TypeTab>("all");

  // Episode data state
  const [episodeData, setEpisodeData] = useState<Record<number, EpisodeInfo>>(
    {},
  );
  const [_episodeDataLoading, setEpisodeDataLoading] = useState(true);

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
          Object.entries(data.episodeData || {}).forEach(
            ([contentId, info]) => {
              const typedInfo = info as EpisodeInfo & {
                nextEpisodeDate?: string;
                latestEpisodeAirDate?: string;
              };
              processedData[Number(contentId)] = {
                ...typedInfo,
                nextEpisodeDate: typedInfo.nextEpisodeDate
                  ? new Date(typedInfo.nextEpisodeDate)
                  : null,
                latestEpisodeAirDate: typedInfo.latestEpisodeAirDate
                  ? new Date(typedInfo.latestEpisodeAirDate)
                  : null,
              };
            },
          );
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

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(
        (item) => item.watchlistItem.status === statusFilter,
      );
    }

    // Apply type tab filter
    if (typeTab === "movies") {
      filtered = filtered.filter(
        (item) => item.watchlistItem.mediaType === "movie",
      );
    } else if (typeTab === "tv") {
      filtered = filtered.filter(
        (item) => item.watchlistItem.mediaType === "tv",
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortOption) {
        case "recently-watched": {
          const aDate =
            a.watchlistItem.lastWatchedAt || a.watchlistItem.createdAt;
          const bDate =
            b.watchlistItem.lastWatchedAt || b.watchlistItem.createdAt;
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
          const aDate =
            a.watchlistItem.lastWatchedAt || a.watchlistItem.createdAt;
          const bDate =
            b.watchlistItem.lastWatchedAt || b.watchlistItem.createdAt;
          return bDate.getTime() - aDate.getTime();
        }
        case "recently-added": {
          return (
            b.watchlistItem.createdAt.getTime() -
            a.watchlistItem.createdAt.getTime()
          );
        }
        default:
          return 0;
      }
    });

    return filtered;
  }, [allItems, searchQuery, sortOption, statusFilter, typeTab, episodeData]);

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

  // Calculate stats
  const stats = useMemo(() => {
    const movieCount = watchlistItems.filter(
      (i) => i.mediaType === "movie",
    ).length;
    const tvCount = watchlistItems.filter((i) => i.mediaType === "tv").length;
    return { movieCount, tvCount, total: watchlistItems.length };
  }, [watchlistItems]);

  const handleStatusChange = async (
    itemId: string,
    newStatus: "watching" | "waiting" | "finished",
  ) => {
    // 1. Find item to backup
    const itemToUpdate = allItems.find(
      (item) => item.watchlistItem.id === itemId,
    );
    if (!itemToUpdate) return;

    const oldStatus = itemToUpdate.watchlistItem.status;

    // 2. Optimistic update
    const updatedAllItems = allItems.map((item) => {
      if (item.watchlistItem.id === itemId) {
        return {
          ...item,
          watchlistItem: {
            ...item.watchlistItem,
            status: newStatus,
          },
        };
      }
      return item;
    });
    setAllItems(updatedAllItems);

    const updatedWatchlistItems = watchlistItems.map((item) => {
      if (item.id === itemId) {
        return { ...item, status: newStatus };
      }
      return item;
    });
    setWatchlistItems(updatedWatchlistItems);

    toast.success("Status updated");

    try {
      // 3. API Call
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
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status, reverting changes");

      // 4. Revert on failure
      setAllItems(
        allItems.map((item) => {
          if (item.watchlistItem.id === itemId) {
            return {
              ...item,
              watchlistItem: {
                ...item.watchlistItem,
                status: oldStatus,
              },
            };
          }
          return item;
        }),
      );
      setWatchlistItems(
        watchlistItems.map((item) => {
          if (item.id === itemId) {
            return { ...item, status: oldStatus };
          }
          return item;
        }),
      );
    }
  };

  // Global Empty State
  if (watchlistItems.length === 0) {
    return (
      <div className="container mx-auto px-4 py-24 flex flex-col items-center justify-center text-center min-h-[60vh] animate-in fade-in duration-700">
        <div className="bg-muted/30 p-6 rounded-full mb-6">
          <div className="flex gap-2">
            <Film className="w-8 h-8 text-muted-foreground" />
            <Tv className="w-8 h-8 text-muted-foreground" />
          </div>
        </div>
        <h1 className="text-3xl font-bold mb-2">Your watchlist is empty</h1>
        <p className="text-muted-foreground max-w-md mb-8 text-lg">
          Start building your collection by adding movies and TV shows you want
          to watch.
        </p>
        <div className="flex gap-4">
          <Link
            href="/browse/genre/movies"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-6 py-2"
          >
            Browse Movies
          </Link>
          <Link
            href="/browse/genre/tv"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-6 py-2"
          >
            Browse TV Shows
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 pt-24 pb-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-foreground">My Watchlist</h1>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>{stats.total} items</span>
            <span>•</span>
            <span>{stats.movieCount} movies</span>
            <span>•</span>
            <span>{stats.tvCount} TV shows</span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <WatchlistControls
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sortOption={sortOption}
        onSortChange={setSortOption}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        typeTab={typeTab}
        onTypeTabChange={setTypeTab}
      />

      {/* Sections */}
      <div className="space-y-12">
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

        {/* Empty Search/Filter State */}
        {filteredAndSortedItems.length === 0 && (
          <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
            <p className="text-lg">No items match your filters</p>
            <button
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("all");
                setTypeTab("all");
              }}
              className="text-primary hover:underline mt-2 text-sm"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
