"use client";

import type { EpisodeInfo } from "@/lib/domain/episodes";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  WatchlistControls,
  WatchlistSection,
  WatchlistSectionHeaderContent,
  type SortOption,
  type StatusFilter,
  type TypeTab,
} from "@/components/watchlist/watchlist";
import { getTitle, MediaItem } from "@/lib/domain/typings";
import type { WatchlistItem, WatchlistStatus } from "@/lib/domain/watchlist";
import { useMalListIndex } from "@/hooks/use-mal-list-index";
import {
  malListIndexKey,
  type MalListIndexItem,
} from "@/lib/mal/list-index-shared";
import {
  MAL_WATCHLIST_SECTIONS,
  type MalWatchlistSectionId,
} from "@/lib/mal/sections";
import { Bookmark, BookmarkCheck, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const SECTION_EMPTY_DESCRIPTIONS: Record<MalWatchlistSectionId, string> = {
  watching: "Nothing in progress right now.",
  completed: "No completed titles yet.",
  on_hold: "Nothing on hold.",
  dropped: "Nothing dropped.",
  plan_to_watch: "No titles in Plan to Watch yet.",
};

const toTimestamp = (value: Date | string | null | undefined) => {
  if (!value) return 0;
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
};

const DummyWatchlistButton = () => {
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const BookmarkIcon = isInWatchlist ? BookmarkCheck : Bookmark;

  return (
    <Button
      variant="outline"
      size="default"
      onClick={() => setIsInWatchlist(!isInWatchlist)}
      className="inline-flex items-center gap-1.5 h-8 px-3 mx-1 bg-black/30 backdrop-blur-md border-white/20"
      aria-label={isInWatchlist ? "Remove from watchlist" : "Add to watchlist"}
    >
      <span className="sr-only">
        {isInWatchlist ? "Remove from watchlist" : "Add to watchlist"}
      </span>
      <BookmarkIcon className="h-4 w-4" aria-hidden="true" />
    </Button>
  );
};

interface WatchlistClientProps {
  allItems: Array<
    MediaItem & { watchlistItem: WatchlistItem; isUnavailable?: boolean }
  >;
  watchlistItems: WatchlistItem[];
}

export function WatchlistClient({
  allItems: initialAllItems,
  watchlistItems: initialWatchlistItems,
}: WatchlistClientProps) {
  const [allItems, setAllItems] = useState(initialAllItems);
  const [watchlistItems, setWatchlistItems] = useState(initialWatchlistItems);

  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("recently-watched");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeTab, setTypeTab] = useState<TypeTab>("all");

  const [episodeData, setEpisodeData] = useState<Record<number, EpisodeInfo>>(
    {},
  );
  const [_episodeDataLoading, setEpisodeDataLoading] = useState(true);
  const { malConnected, items: malListItems } = useMalListIndex();

  const malIndex = useMemo(() => {
    const map = new Map<string, MalListIndexItem>();
    for (const entry of malListItems) {
      map.set(malListIndexKey(entry.mediaType, entry.tmdbId), entry);
    }
    return map;
  }, [malListItems]);

  useEffect(() => {
    const fetchEpisodeData = async () => {
      try {
        setEpisodeDataLoading(true);
        const response = await fetch("/api/watchlist/check-episodes");
        if (response.ok) {
          const data = await response.json();
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
      } finally {
        setEpisodeDataLoading(false);
      }
    };

    fetchEpisodeData();
  }, []);

  const episodeInfoMap = useMemo(() => {
    const map = new Map<number, EpisodeInfo | null>();
    Object.entries(episodeData).forEach(([contentId, info]) => {
      map.set(Number(contentId), info);
    });
    return map;
  }, [episodeData]);

  const filteredAndSortedItems = useMemo(() => {
    let filtered = [...allItems];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((item) => {
        const title = getTitle(item);
        return title.toLowerCase().includes(query);
      });
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(
        (item) => item.watchlistItem.status === statusFilter,
      );
    }

    if (typeTab === "movies") {
      filtered = filtered.filter(
        (item) => item.watchlistItem.mediaType === "movie",
      );
    } else if (typeTab === "tv") {
      filtered = filtered.filter(
        (item) => item.watchlistItem.mediaType === "tv",
      );
    }

    return filtered;
  }, [allItems, searchQuery, statusFilter, typeTab]);

  const sortedItems = useMemo(() => {
    const items = [...filteredAndSortedItems];
    items.sort((a, b) => {
      switch (sortOption) {
        case "recently-watched": {
          const aDate =
            a.watchlistItem.lastWatchedAt || a.watchlistItem.createdAt;
          const bDate =
            b.watchlistItem.lastWatchedAt || b.watchlistItem.createdAt;
          return toTimestamp(bDate) - toTimestamp(aDate);
        }
        case "new-episodes": {
          const aInfo = episodeData[a.id];
          const bInfo = episodeData[b.id];

          if (aInfo?.hasNewEpisodes && !bInfo?.hasNewEpisodes) return -1;
          if (!aInfo?.hasNewEpisodes && bInfo?.hasNewEpisodes) return 1;

          if (aInfo?.hasNewEpisodes && bInfo?.hasNewEpisodes) {
            const aDate = aInfo.latestEpisodeAirDate?.getTime() || 0;
            const bDate = bInfo.latestEpisodeAirDate?.getTime() || 0;
            return bDate - aDate;
          }

          const aDate =
            a.watchlistItem.lastWatchedAt || a.watchlistItem.createdAt;
          const bDate =
            b.watchlistItem.lastWatchedAt || b.watchlistItem.createdAt;
          return toTimestamp(bDate) - toTimestamp(aDate);
        }
        case "recently-added": {
          return (
            toTimestamp(b.watchlistItem.createdAt) -
            toTimestamp(a.watchlistItem.createdAt)
          );
        }
        default:
          return 0;
      }
    });
    return items;
  }, [filteredAndSortedItems, sortOption, episodeData]);

  const itemsByStatus = useMemo(() => {
    const map = new Map<WatchlistStatus, typeof sortedItems>(
      MAL_WATCHLIST_SECTIONS.map((section) => [section.status, []]),
    );
    for (const item of sortedItems) {
      map.get(item.watchlistItem.status)?.push(item);
    }
    return map;
  }, [sortedItems]);

  const stats = useMemo(() => {
    const unavailableCount = allItems.filter((item) =>
      Boolean(item.isUnavailable),
    ).length;

    const counts = Object.fromEntries(
      MAL_WATCHLIST_SECTIONS.map((section) => [
        section.status,
        watchlistItems.filter((item) => item.status === section.status).length,
      ]),
    ) as Record<WatchlistStatus, number>;

    return {
      total: watchlistItems.length,
      counts,
      unavailableCount,
    };
  }, [allItems, watchlistItems]);

  const handleStatusChange = async (
    itemId: string,
    newStatus: WatchlistStatus,
  ) => {
    const itemToUpdate = allItems.find(
      (item) => item.watchlistItem.id === itemId,
    );
    if (!itemToUpdate) return;

    const oldStatus = itemToUpdate.watchlistItem.status;

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

  const handleRemoveItem = async (itemId: string) => {
    const previousAllItems = allItems;
    const previousWatchlistItems = watchlistItems;

    setAllItems(allItems.filter((item) => item.watchlistItem.id !== itemId));
    setWatchlistItems(watchlistItems.filter((item) => item.id !== itemId));

    toast.success("Removed from watchlist");

    try {
      const response = await fetch(`/api/watchlist/${itemId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to remove from watchlist");
      }
    } catch (error) {
      console.error("Error removing item:", error);
      toast.error("Failed to remove from watchlist, reverting changes");
      setAllItems(previousAllItems);
      setWatchlistItems(previousWatchlistItems);
    }
  };

  if (watchlistItems.length === 0) {
    return (
      <div className="relative mx-auto flex min-h-[calc(100vh-7rem)] w-full max-w-7xl items-center justify-center px-4 pt-10 pb-14">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[70vh] bg-linear-to-b from-black/80 via-black/70 to-transparent" />
        <Card className="w-full max-w-2xl border border-white/10 bg-background/82 shadow-xl shadow-black/20 backdrop-blur-xl">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <h1 className="mb-4 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Watchlist is empty
            </h1>
            <p className="mb-10 max-w-md text-balance text-lg text-muted-foreground">
              Start building your watchlist by clicking the{" "}
              <DummyWatchlistButton /> button on any movie or TV show you want
              to track.
            </p>
            <div className="flex w-full flex-col sm:w-auto sm:flex-row gap-4">
              <Button asChild variant="chrome" size="lg" className="sm:w-auto">
                <Link href="/movies">Browse Movies</Link>
              </Button>
              <Button asChild variant="chrome" size="lg" className="sm:w-auto">
                <Link href="/tvshows">Browse TV Shows</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative mx-auto min-h-[calc(100vh-7rem)] w-full max-w-7xl px-4 pt-10 pb-14">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[70vh] bg-linear-to-b from-black/80 via-black/70 to-transparent" />

      <div className="overflow-hidden rounded-lg border border-white/10 bg-background/82 shadow-xl shadow-black/20 backdrop-blur-xl">
        <div className="border-b border-white/10 px-4 py-5 md:px-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1.5">
              <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                My Watchlist
              </h1>
              <p className="max-w-xl text-sm leading-5 text-zinc-300">
                {malConnected
                  ? "Synced with your MyAnimeList — status, score, and episode progress."
                  : "Track what you're watching and what's next."}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:min-w-[420px] lg:grid-cols-5">
              {MAL_WATCHLIST_SECTIONS.map((section) => (
                <StatTile
                  key={section.id}
                  label={section.title}
                  value={stats.counts[section.status]}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="border-b border-white/10 bg-white/[0.02] px-4 py-4 md:px-6">
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
          <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-white/8 pt-3">
            <Button asChild size="sm" className="h-8 gap-1.5 px-3">
              <Link href="/search">
                <Plus className="h-3.5 w-3.5" />
                Add item
              </Link>
            </Button>
          </div>
        </div>

        {stats.unavailableCount > 0 && (
          <div className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 md:px-6">
            {stats.unavailableCount} saved{" "}
            {stats.unavailableCount === 1 ? "title" : "titles"} could not be
            resolved from media providers and{" "}
            {stats.unavailableCount === 1 ? "is" : "are"} displayed as
            unavailable below. You can remove or manage them directly.
          </div>
        )}

        <Accordion
          type="multiple"
          defaultValue={MAL_WATCHLIST_SECTIONS.map((section) => section.id)}
          className="w-full"
        >
          {MAL_WATCHLIST_SECTIONS.map((section) => (
            <WatchlistAccordionSection
              key={section.id}
              value={section.id}
              title={section.title}
              status={section.status}
              items={itemsByStatus.get(section.status) ?? []}
              episodeInfoMap={episodeInfoMap}
              onStatusChange={handleStatusChange}
              onRemoveItem={handleRemoveItem}
              malConnected={malConnected}
              malIndex={malIndex}
              emptyDescription={SECTION_EMPTY_DESCRIPTIONS[section.id]}
            />
          ))}
        </Accordion>

        {sortedItems.length === 0 && (
          <div className="px-4 py-12 text-center text-muted-foreground md:px-6">
            <p className="text-lg">No items match your filters</p>
            <button
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("all");
                setTypeTab("all");
              }}
              className="mt-2 text-sm text-primary hover:underline"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function WatchlistAccordionSection({
  value,
  title,
  status,
  items,
  episodeInfoMap,
  emptyDescription,
  onStatusChange,
  onRemoveItem,
  malConnected = false,
  malIndex,
  onMalUpdated,
}: {
  value: string;
  title: string;
  status: WatchlistStatus;
  items: Array<
    MediaItem & { watchlistItem: WatchlistItem; isUnavailable?: boolean }
  >;
  episodeInfoMap: Map<number, EpisodeInfo | null>;
  emptyDescription?: string;
  onStatusChange: (itemId: string, newStatus: WatchlistStatus) => void;
  onRemoveItem: (itemId: string) => void;
  malConnected?: boolean;
  malIndex?: Map<string, MalListIndexItem>;
  onMalUpdated?: () => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
  };

  const handleDrop = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDragOver(false);

    const itemId = event.dataTransfer.getData("application/x-watchlist-item");
    const currentStatus = event.dataTransfer.getData(
      "application/x-watchlist-status",
    );

    if (!itemId || currentStatus === status) {
      return;
    }

    onStatusChange(itemId, status);
  };

  return (
    <AccordionItem
      value={value}
      onDragOver={handleDragOver}
      onDragEnter={() => setIsDragOver(true)}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsDragOver(false);
        }
      }}
      onDrop={handleDrop}
      className={cn(
        "px-4 transition-colors duration-200 md:px-6",
        isDragOver && "bg-primary/10 ring-inset ring-1 ring-primary/40",
      )}
    >
      <AccordionTrigger className="py-4 hover:no-underline">
        <WatchlistSectionHeaderContent title={title} status={status} />
      </AccordionTrigger>
      <AccordionContent className="pt-2 pb-5">
        <WatchlistSection
          status={status}
          items={items}
          episodeInfoMap={episodeInfoMap}
          onStatusChange={onStatusChange}
          onRemoveItem={onRemoveItem}
          emptyDescription={emptyDescription}
          malConnected={malConnected}
          malIndex={malIndex}
          onMalUpdated={onMalUpdated}
        />
      </AccordionContent>
    </AccordionItem>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.035] px-3 py-2">
      <div className="text-xl font-semibold tabular-nums leading-none text-foreground">
        {value}
      </div>
      <div className="mt-1 text-[10px] font-medium uppercase tracking-wide text-zinc-300">
        {label}
      </div>
    </div>
  );
}
