"use client";

import { getWatchlistItem, type WatchlistItem } from "@/app/watchlist/actions";
import type { EpisodeInfo } from "@/app/watchlist/episode-check-service";
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
import { tmdbImage } from "@/tmdb/utils";
import { getAirDate, getTitle, MediaItem } from "@/utils/typings";
import {
  Bookmark,
  BookmarkCheck,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Film,
  Search,
  Star,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { type DragEvent, type ReactNode, useEffect, useState } from "react";
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
  const isSignedIn = Boolean(session.data?.user?.id);

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
    if (!isSignedIn)
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
  const isAuthDisabled = !isSignedIn;

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleToggle}
      className={cn(
        className,
        isAuthDisabled &&
          "cursor-not-allowed opacity-70 hover:opacity-70 active:scale-100",
      )}
      disabled={isToggling}
      aria-disabled={isToggling || isAuthDisabled}
      aria-label={isInWatchlist ? "Remove from watchlist" : "Add to watchlist"}
      data-testid={`watchlist-button-${isInWatchlist ? "remove" : "add"}`}
      data-in-watchlist={isInWatchlist}
      data-content-id={contentId}
      data-media-type={mediaType}
      data-auth-disabled={isAuthDisabled}
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
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <Input
          type="text"
          placeholder="Search your watchlist..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-9 rounded-full border-white/12 bg-black/25 pl-9 pr-9 text-sm placeholder:text-zinc-500"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-foreground"
            aria-label="Clear search"
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {!isMounted ? (
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                Sort
              </span>
              <div className="h-9 w-full rounded-full border border-white/15 bg-black/25 px-3 text-sm md:w-[205px]" />
            </div>
            <div className="flex h-9 w-full rounded-full bg-black/35 p-1 md:w-auto">
              {["All", "Movies", "TV Shows"].map((label, index) => (
                <div
                  key={label}
                  className={cn(
                    "h-7 flex-1 rounded-full px-3 md:flex-none",
                    index === 0 && "bg-white",
                  )}
                />
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
              Status
            </span>
            <div className="flex flex-wrap gap-1.5">
              {["All", "Watching", "Waiting", "Finished"].map((label) => (
                <div
                  key={label}
                  className="h-8 flex-1 rounded-full border border-white/15 bg-black/20 px-3 md:flex-none"
                />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex items-center gap-2">
              <label
                htmlFor="sort-select"
                className="text-xs font-medium uppercase tracking-wide text-zinc-400"
              >
                Sort
              </label>
              <Select value={sortOption} onValueChange={onSortChange}>
                <SelectTrigger
                  id="sort-select"
                  className="h-9 w-full rounded-full border-white/15 bg-black/25 text-sm md:w-[205px]"
                >
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
              className="w-full md:w-auto"
            >
              <TabsList className="h-9 w-full rounded-full bg-black/35 p-1 md:w-auto">
                <TabsTrigger
                  value="all"
                  className="h-7 flex-1 rounded-full px-3 text-sm data-[state=active]:bg-white data-[state=active]:text-black md:flex-none"
                >
                  All
                </TabsTrigger>
                <TabsTrigger
                  value="movies"
                  className="h-7 flex-1 rounded-full px-3 text-sm data-[state=active]:bg-white data-[state=active]:text-black md:flex-none"
                >
                  Movies
                </TabsTrigger>
                <TabsTrigger
                  value="tv"
                  className="h-7 flex-1 rounded-full px-3 text-sm data-[state=active]:bg-white data-[state=active]:text-black md:flex-none"
                >
                  TV Shows
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
              Status
            </span>
            <div className="flex flex-wrap gap-1.5">
              <Button
                variant={statusFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => onStatusFilterChange("all")}
                className={cn(
                  "h-8 flex-1 rounded-full px-3 text-sm md:flex-none",
                  statusFilter !== "all" &&
                    "border-white/15 bg-black/20 text-zinc-300 hover:bg-white/10 hover:text-foreground",
                )}
              >
                All
              </Button>
              <Button
                variant={statusFilter === "watching" ? "default" : "outline"}
                size="sm"
                onClick={() => onStatusFilterChange("watching")}
                className={cn(
                  "h-8 flex-1 rounded-full px-3 text-sm md:flex-none",
                  statusFilter !== "watching" &&
                    "border-white/15 bg-black/20 text-zinc-300 hover:bg-white/10 hover:text-foreground",
                )}
              >
                Watching
              </Button>
              <Button
                variant={statusFilter === "waiting" ? "default" : "outline"}
                size="sm"
                onClick={() => onStatusFilterChange("waiting")}
                className={cn(
                  "h-8 flex-1 rounded-full px-3 text-sm md:flex-none",
                  statusFilter !== "waiting" &&
                    "border-white/15 bg-black/20 text-zinc-300 hover:bg-white/10 hover:text-foreground",
                )}
              >
                Waiting
              </Button>
              <Button
                variant={statusFilter === "finished" ? "default" : "outline"}
                size="sm"
                onClick={() => onStatusFilterChange("finished")}
                className={cn(
                  "h-8 flex-1 rounded-full px-3 text-sm md:flex-none",
                  statusFilter !== "finished" &&
                    "border-white/15 bg-black/20 text-zinc-300 hover:bg-white/10 hover:text-foreground",
                )}
              >
                Finished
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface WatchlistSectionProps {
  title: string;
  description: string;
  tone: "watching" | "waiting" | "finished";
  items: Array<MediaItem & { watchlistItem: WatchlistItem }>;
  episodeInfoMap: Map<number, EpisodeInfo | null>;
  emptyDescription?: string;
  onStatusChange: (
    itemId: string,
    newStatus: "watching" | "waiting" | "finished",
  ) => void;
}

export function WatchlistSection({
  title,
  description,
  tone,
  items,
  episodeInfoMap,
  emptyDescription,
  onStatusChange,
}: WatchlistSectionProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
  };

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDragOver(false);

    const itemId = event.dataTransfer.getData("application/x-watchlist-item");
    const currentStatus = event.dataTransfer.getData(
      "application/x-watchlist-status",
    );

    if (!itemId || currentStatus === tone) {
      return;
    }

    onStatusChange(itemId, tone);
  };

  return (
    <section
      onDragOver={handleDragOver}
      onDragEnter={() => setIsDragOver(true)}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsDragOver(false);
        }
      }}
      onDrop={handleDrop}
      className={cn(
        "rounded-xl border border-white/10 bg-black/20 p-4 animate-in fade-in duration-500",
        isDragOver && "border-primary/50 bg-primary/10 ring-1 ring-primary/30",
      )}
    >
      <div className="mb-3 flex min-h-11 items-center justify-between border-b border-white/8 pb-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                tone === "watching" && "bg-emerald-400",
                tone === "waiting" && "bg-sky-400",
                tone === "finished" && "bg-zinc-400",
              )}
            />
            {title}
            <span className="rounded-full bg-white/8 px-2 py-0.5 text-xs font-medium text-zinc-300">
              {items.length}
            </span>
          </h2>
          <p className="mt-1 text-xs text-zinc-400">{description}</p>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="flex min-h-20 items-center justify-center gap-2 rounded-lg border border-dashed border-white/12 bg-black/20 px-4 py-4 text-center text-sm text-zinc-300">
          <Film className="h-4 w-4 text-zinc-500" />
          <span>{emptyDescription || "No titles in this section yet."}</span>
        </div>
      ) : (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr))]">
          {items.map((item) => (
            <WatchlistBannerCard
              key={`${item.watchlistItem.mediaType}-${item.id}`}
              item={item}
              episodeInfo={item.id ? episodeInfoMap.get(item.id) : null}
              onStatusChange={onStatusChange}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function WatchlistBannerCard({
  item,
  episodeInfo,
  onStatusChange,
}: {
  item: MediaItem & { watchlistItem: WatchlistItem };
  episodeInfo?: EpisodeInfo | null;
  onStatusChange: (
    itemId: string,
    newStatus: "watching" | "waiting" | "finished",
  ) => void;
}) {
  const title = getTitle(item);
  const year = getAirDate(item)?.slice(0, 4);
  const mediaType = item.watchlistItem.mediaType;
  const image = item.backdrop_path
    ? tmdbImage.backdrop(item.backdrop_path, "w780")
    : item.poster_path
      ? tmdbImage.poster(item.poster_path, "w342")
      : null;
  const href =
    mediaType === "movie" ? `/movies/${item.id}` : `/tvshows/${item.id}`;

  return (
    <motion.article
      draggable
      onDragStartCapture={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData(
          "application/x-watchlist-item",
          item.watchlistItem.id,
        );
        event.dataTransfer.setData(
          "application/x-watchlist-status",
          item.watchlistItem.status,
        );
      }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="group relative min-h-44 cursor-grab overflow-hidden rounded-2xl border border-white/12 bg-black/30 shadow-lg shadow-black/20 transition-colors hover:border-white/25 active:cursor-grabbing"
    >
      {image && (
        <Image
          src={image}
          alt=""
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover opacity-80 transition duration-300 group-hover:scale-[1.025] group-hover:opacity-90"
        />
      )}
      <div className="absolute inset-0 bg-linear-to-r from-black/70 via-black/30 to-black/5" />
      <div className="absolute inset-0 bg-linear-to-t from-black/45 via-transparent to-black/10" />
      <Link
        href={href}
        draggable={false}
        className="absolute inset-0 z-10"
        aria-label={title}
      />

      <div className="pointer-events-none relative z-20 flex min-h-44 flex-col justify-between p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 rounded-xl border border-white/10 bg-black/25 px-3 py-2 shadow-lg shadow-black/15 backdrop-blur-[2px]">
            <h3 className="line-clamp-2 text-lg font-semibold leading-tight text-white drop-shadow">
              {title}
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-medium text-zinc-200">
              <span className="rounded-full bg-white/15 px-2 py-0.5 capitalize">
                {mediaType === "tv" ? "TV show" : "Movie"}
              </span>
              {year && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {year}
                </span>
              )}
              {item.vote_average > 0 && (
                <span className="inline-flex items-center gap-1 text-zinc-200">
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  {item.vote_average.toFixed(1)}
                </span>
              )}
            </div>
          </div>

          <div className="group/status pointer-events-auto relative z-30 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            <Badge className="h-8 rounded-full border border-white/20 bg-black/40 px-3 text-xs font-medium text-zinc-100 shadow-lg backdrop-blur-md hover:bg-black/55">
              Move
              <ChevronDown className="ml-1 h-3 w-3" />
            </Badge>
            <div className="absolute right-0 top-9 hidden min-w-32 rounded-xl border border-white/12 bg-black/90 p-1 shadow-2xl backdrop-blur-xl group-hover/status:block">
              {(["watching", "waiting", "finished"] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onStatusChange(item.watchlistItem.id, status);
                  }}
                  className={cn(
                    "block w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-zinc-300 hover:bg-white/10 hover:text-white",
                    item.watchlistItem.status === status &&
                      "bg-white text-black hover:bg-white hover:text-black",
                  )}
                >
                  {getStatusLabel(status)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          {mediaType === "tv" && item.id ? (
            <EpisodeIndicator
              contentId={item.id}
              mediaType="tv"
              episodeInfo={episodeInfo || null}
            />
          ) : null}
          <div className="ml-auto inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-xs font-medium text-zinc-200 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
            View details
            <ExternalLink className="h-3 w-3" />
          </div>
        </div>
      </div>
    </motion.article>
  );
}

function getStatusLabel(status: WatchlistItem["status"]) {
  if (status === "waiting") return "Waiting";
  if (status === "finished") return "Finished";
  return "Watching";
}
