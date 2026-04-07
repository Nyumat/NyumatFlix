"use client";

import { getWatchlistItem, type WatchlistItem } from "@/app/watchlist/actions";
import type { EpisodeInfo } from "@/app/watchlist/episode-check-service";
import { MediaContentGrid } from "@/components/content/media-content-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { formatCountdown } from "@/lib/utils/countdown";
import { MediaItem } from "@/utils/typings";
import { Bookmark, BookmarkCheck, CheckCircle2, Search, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { type ReactNode, useEffect, useState } from "react";
import { toast } from "sonner";

interface EpisodeProgressIndicatorProps {
  seasonNumber: number;
  episodeNumber: number;
  watchlistItem: WatchlistItem | null;
  className?: string;
}

export function EpisodeProgressIndicator({
  seasonNumber,
  episodeNumber,
  watchlistItem,
  className,
}: EpisodeProgressIndicatorProps) {
  const isLastWatched =
    watchlistItem &&
    watchlistItem.lastWatchedSeason === seasonNumber &&
    watchlistItem.lastWatchedEpisode === episodeNumber;

  if (!isLastWatched) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-xs text-primary font-medium",
        className,
      )}
      title="Last watched episode"
    >
      <CheckCircle2 className="h-3.5 w-3.5" />
      <span>Last watched</span>
    </div>
  );
}

interface EpisodeIndicatorProps {
  contentId: number;
  mediaType: "movie" | "tv";
  episodeInfo: EpisodeInfo | null;
}

export function EpisodeIndicator({
  contentId: _contentId,
  mediaType,
  episodeInfo,
}: EpisodeIndicatorProps) {
  const [countdown, setCountdown] = useState<string | null>(
    episodeInfo?.countdown || null,
  );

  useEffect(() => {
    if (!episodeInfo?.nextEpisodeDate) {
      return;
    }

    const updateCountdown = () => {
      const newCountdown = formatCountdown(episodeInfo.nextEpisodeDate!);
      setCountdown(newCountdown);
    };

    updateCountdown();

    const interval = setInterval(updateCountdown, 60 * 1000);

    return () => clearInterval(interval);
  }, [episodeInfo?.nextEpisodeDate]);

  if (mediaType !== "tv" || !episodeInfo) {
    return null;
  }

  if (episodeInfo.hasNewEpisodes && episodeInfo.newEpisodeCount > 0) {
    return (
      <Badge
        variant="default"
        className="bg-primary text-primary-foreground text-xs font-medium"
      >
        {episodeInfo.newEpisodeCount === 1
          ? "1 new episode"
          : `${episodeInfo.newEpisodeCount} new episodes`}
      </Badge>
    );
  }

  if (episodeInfo.nextEpisodeDate && countdown) {
    return (
      <Badge
        variant="outline"
        className="border-primary/50 text-primary text-xs font-medium"
      >
        {countdown} until next episode
      </Badge>
    );
  }

  return null;
}

interface WatchlistButtonProps {
  contentId: number;
  mediaType?: "movie" | "tv";
  className?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  children?: ReactNode;
}

export function WatchlistButton({
  contentId,
  mediaType,
  className,
  variant = "outline",
  size = "default",
  children,
}: WatchlistButtonProps) {
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const session = useSession();

  useEffect(() => {
    if (!mediaType) return;
    const checkWatchlistStatus = async () => {
      try {
        const item = await getWatchlistItem(contentId, mediaType);
        setIsInWatchlist(!!item);
      } catch (error) {
        console.error("Error checking watchlist status:", error);
      } finally {
        setIsLoading(false);
      }
    };
    checkWatchlistStatus();
  }, [contentId, mediaType]);

  const handleToggle = async () => {
    if (isLoading || isToggling) return;
    if (!session.data?.user?.id)
      return toast.error(
        "To add items to your watchlist, you must be logged in.",
      );

    setIsToggling(true);
    try {
      if (isInWatchlist) {
        if (!mediaType) return;
        const item = await getWatchlistItem(contentId, mediaType);
        if (!item) {
          setIsInWatchlist(false);
          return;
        }

        const response = await fetch(`/api/watchlist/${item.id}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          throw new Error("Failed to remove from watchlist");
        }

        setIsInWatchlist(false);
        toast.success("Removed from watchlist");
      } else {
        if (!mediaType) return;
        const response = await fetch("/api/watchlist", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contentId,
            mediaType,
            status: "watching",
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to add to watchlist");
        }

        setIsInWatchlist(true);
        toast.success("Added to watchlist");
      }
    } catch (error) {
      console.error("Error toggling watchlist:", error);
      toast.error(
        isInWatchlist
          ? "Failed to remove from watchlist"
          : "Failed to add to watchlist",
      );
    } finally {
      setIsToggling(false);
    }
  };

  if (isLoading) {
    return (
      <Button
        variant={variant}
        size={size}
        className={cn(className)}
        disabled
        data-testid="watchlist-button-loading"
      >
        <Bookmark className="h-4 w-4" />
        {children && (
          <span
            className="ml-2 text-sm"
            data-testid="watchlist-button-loading-text"
          >
            Loading...
          </span>
        )}
      </Button>
    );
  }

  const Icon = isInWatchlist ? BookmarkCheck : Bookmark;

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleToggle}
      className={cn(className)}
      disabled={isToggling}
      aria-label={isInWatchlist ? "Remove from watchlist" : "Add to watchlist"}
      data-testid={`watchlist-button-${isInWatchlist ? "remove" : "add"}`}
      data-in-watchlist={isInWatchlist}
      data-content-id={contentId}
      data-media-type={mediaType}
    >
      <Icon className="h-4 w-4" />
      {children && (
        <span
          className="ml-2 text-sm font-medium"
          data-testid="watchlist-button-text"
        >
          {children}
        </span>
      )}
    </Button>
  );
}

export type SortOption = "recently-watched" | "new-episodes" | "recently-added";
export type StatusFilter = "all" | "watching" | "waiting" | "finished";
export type TypeTab = "all" | "movies" | "tv";

interface WatchlistControlsProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortOption: SortOption;
  onSortChange: (sort: SortOption) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (filter: StatusFilter) => void;
  typeTab: TypeTab;
  onTypeTabChange: (tab: TypeTab) => void;
}

export function WatchlistControls({
  searchQuery,
  onSearchChange,
  sortOption,
  onSortChange,
  statusFilter,
  onStatusFilterChange,
  typeTab,
  onTypeTabChange,
}: WatchlistControlsProps) {
  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search your watchlist..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 pr-10"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label
              htmlFor="sort-select"
              className="text-sm text-muted-foreground whitespace-nowrap"
            >
              Sort by:
            </label>
            <Select value={sortOption} onValueChange={onSortChange}>
              <SelectTrigger id="sort-select" className="w-full sm:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recently-watched">
                  Most Recently Watched
                </SelectItem>
                <SelectItem value="new-episodes">
                  New Episodes Available
                </SelectItem>
                <SelectItem value="recently-added">Recently Added</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Tabs
            value={typeTab}
            onValueChange={(value) => onTypeTabChange(value as TypeTab)}
            className="w-full sm:w-auto"
          >
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="all" className="flex-1 sm:flex-none">
                All
              </TabsTrigger>
              <TabsTrigger value="movies" className="flex-1 sm:flex-none">
                Movies
              </TabsTrigger>
              <TabsTrigger value="tv" className="flex-1 sm:flex-none">
                TV Shows
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full lg:w-auto">
          <span className="text-sm text-muted-foreground whitespace-nowrap hidden sm:inline-block">
            Status:
          </span>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <Button
              variant={statusFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => onStatusFilterChange("all")}
              className="flex-1 sm:flex-none"
            >
              All
            </Button>
            <Button
              variant={statusFilter === "watching" ? "default" : "outline"}
              size="sm"
              onClick={() => onStatusFilterChange("watching")}
              className="flex-1 sm:flex-none"
            >
              Watching
            </Button>
            <Button
              variant={statusFilter === "waiting" ? "default" : "outline"}
              size="sm"
              onClick={() => onStatusFilterChange("waiting")}
              className="flex-1 sm:flex-none"
            >
              Waiting
            </Button>
            <Button
              variant={statusFilter === "finished" ? "default" : "outline"}
              size="sm"
              onClick={() => onStatusFilterChange("finished")}
              className="flex-1 sm:flex-none"
            >
              Finished
            </Button>
          </div>
        </div>
      </div>
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

export function WatchlistSection({
  title,
  items,
  watchlistItemsMap,
  episodeInfoMap,
  onStatusChange,
}: WatchlistSectionProps) {
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
