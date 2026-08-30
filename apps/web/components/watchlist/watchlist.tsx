"use client";

import { getWatchlistItem } from "@/app/watchlist/actions";
import type { EpisodeInfo } from "@/lib/domain/episodes";
import type { WatchlistItem, WatchlistStatus } from "@/lib/domain/watchlist";
import { MalListControls } from "@/components/media/mal-list-controls";
import { buildAnilistTvDetailHref } from "@/lib/anilist-route-id";
import type { MalListIndexItem } from "@/lib/mal/list-index-shared";
import { malListIndexKey } from "@/lib/mal/list-index-shared";
import { resolveInitialWatchlistStatus } from "@/lib/watchlist/resolve-initial-watchlist-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { loginHref } from "@/lib/auth/callback-url";
import { cn } from "@/lib/utils";
import { formatCountdown } from "@/lib/utils/countdown";
import { tmdbImage } from "@/tmdb/utils";
import { getAirDate, getTitle, MediaItem } from "@/lib/domain/typings";
import { getMediaLabel } from "@/lib/cards/selectors";
import {
  AlertTriangle,
  Bookmark,
  BookmarkCheck,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Film,
  MoreVertical,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  type DragEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
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
        className="rounded-md bg-primary text-primary-foreground text-xs font-medium"
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
        className="rounded-md border-primary/50 text-primary text-xs font-medium"
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
  onWatchlistChange?: () => void;
}

export function WatchlistButton({
  contentId,
  mediaType,
  className,
  variant = "outline",
  size = "default",
  children,
  onWatchlistChange,
}: WatchlistButtonProps) {
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const isTogglingRef = useRef(false);
  const session = useSession();
  const pathname = usePathname();
  const isSignedIn = Boolean(session.data?.user?.id);

  useEffect(() => {
    if (!mediaType) return;

    let cancelled = false;

    const checkWatchlistStatus = async () => {
      try {
        const item = await getWatchlistItem(contentId, mediaType);
        if (cancelled) return;
        setIsInWatchlist(!!item);
      } catch (error) {
        console.error("Error checking watchlist status:", error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    setIsLoading(true);
    void checkWatchlistStatus();

    return () => {
      cancelled = true;
    };
  }, [contentId, mediaType]);

  const handleToggle = async () => {
    if (isLoading || isToggling || isTogglingRef.current) return;
    if (!isSignedIn) {
      toast.error("To add items to your watchlist, you must be logged in.", {
        action: {
          label: "Sign in",
          onClick: () => {
            window.location.assign(loginHref(pathname));
          },
        },
      });
      return;
    }

    isTogglingRef.current = true;
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
        onWatchlistChange?.();
      } else {
        if (!mediaType) return;
        const resolved = resolveInitialWatchlistStatus({
          contentId,
          mediaType,
        });

        const response = await fetch("/api/watchlist", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contentId,
            mediaType,
            status: resolved.status,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to add to watchlist");
        }

        setIsInWatchlist(true);
        toast.success(resolved.label);
        onWatchlistChange?.();
      }
    } catch (error) {
      console.error("Error toggling watchlist:", error);
      toast.error(
        isInWatchlist
          ? "Failed to remove from watchlist"
          : "Failed to add to watchlist",
      );
    } finally {
      isTogglingRef.current = false;
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
export type StatusFilter =
  | "all"
  | "watching"
  | "plan_to_watch"
  | "on_hold"
  | "dropped"
  | "completed";
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
  hideStatusFilter?: boolean;
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
  hideStatusFilter = false,
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
          className="h-9 rounded-md border-white/12 bg-black/25 pl-9 pr-9 text-sm placeholder:text-zinc-500"
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
              <div className="h-9 w-full rounded-md border border-white/15 bg-black/25 px-3 text-sm md:w-[205px]" />
            </div>
            <div className="flex h-9 w-full rounded-md bg-black/35 p-1 md:w-auto">
              {["All", "Movies", "TV Shows"].map((label, index) => (
                <div
                  key={label}
                  className={cn(
                    "h-7 flex-1 rounded-sm px-3 md:flex-none",
                    index === 0 && "bg-white",
                  )}
                />
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            {!hideStatusFilter ? (
              <>
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                  Status
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "All",
                    "Watching",
                    "Plan to Watch",
                    "On-Hold",
                    "Dropped",
                    "Completed",
                  ].map((label) => (
                    <div
                      key={label}
                      className="h-8 flex-1 rounded-md border border-white/15 bg-black/20 px-3 md:flex-none"
                    />
                  ))}
                </div>
              </>
            ) : null}
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
                  className="h-9 w-full rounded-md border-white/15 bg-black/25 text-sm md:w-[205px]"
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
              <TabsList className="h-9 w-full rounded-md bg-black/35 p-1 md:w-auto">
                <TabsTrigger
                  value="all"
                  className="h-7 flex-1 rounded-sm px-3 text-sm data-[state=active]:bg-white data-[state=active]:text-black md:flex-none"
                >
                  All
                </TabsTrigger>
                <TabsTrigger
                  value="movies"
                  className="h-7 flex-1 rounded-sm px-3 text-sm data-[state=active]:bg-white data-[state=active]:text-black md:flex-none"
                >
                  Movies
                </TabsTrigger>
                <TabsTrigger
                  value="tv"
                  className="h-7 flex-1 rounded-sm px-3 text-sm data-[state=active]:bg-white data-[state=active]:text-black md:flex-none"
                >
                  TV Shows
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {!hideStatusFilter ? (
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                Status
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { value: "all", label: "All" },
                    { value: "watching", label: "Watching" },
                    { value: "plan_to_watch", label: "Plan to Watch" },
                    { value: "on_hold", label: "On-Hold" },
                    { value: "dropped", label: "Dropped" },
                    { value: "completed", label: "Completed" },
                  ] as const
                ).map(({ value, label }) => (
                  <Button
                    key={value}
                    variant={statusFilter === value ? "default" : "outline"}
                    size="sm"
                    onClick={() => onStatusFilterChange(value)}
                    className={cn(
                      "h-8 flex-1 rounded-md px-3 text-sm md:flex-none",
                      statusFilter !== value &&
                        "border-white/15 bg-black/20 text-zinc-300 hover:bg-white/10 hover:text-foreground",
                    )}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

interface WatchlistSectionProps {
  title?: string;
  description?: string;
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
  disableDragDrop?: boolean;
}

export function WatchlistSectionHeaderContent({
  title,
}: {
  title: string;
  status?: WatchlistStatus;
}) {
  return (
    <div className="flex items-center gap-3 text-left">
      <span className="text-lg font-semibold text-foreground">{title}</span>
    </div>
  );
}

export function WatchlistSection({
  status,
  items,
  episodeInfoMap,
  emptyDescription,
  onStatusChange,
  onRemoveItem,
  malConnected = false,
  malIndex,
  onMalUpdated,
  disableDragDrop = false,
}: WatchlistSectionProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    if (disableDragDrop) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
  };

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    if (disableDragDrop) return;
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
        "rounded-lg transition-colors duration-200",
        isDragOver && "bg-primary/10 ring-inset ring-1 ring-primary/40",
      )}
    >
      {items.length === 0 ? (
        <div className="flex min-h-24 items-center justify-center gap-2 rounded-lg border border-dashed border-white/10 bg-black/20 px-4 py-6 text-center text-sm text-zinc-400">
          <Film className="h-4 w-4 text-zinc-500" />
          <span>{emptyDescription || "No titles in this section yet."}</span>
        </div>
      ) : (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr))]">
          {items.map((item) => {
            const malEntry = malIndex?.get(
              malListIndexKey(
                item.watchlistItem.mediaType,
                item.watchlistItem.contentId,
              ),
            );

            return (
              <WatchlistBannerCard
                key={`${item.watchlistItem.mediaType}-${item.watchlistItem.id}`}
                item={item}
                episodeInfo={item.id ? episodeInfoMap.get(item.id) : null}
                malEntry={malEntry}
                malConnected={malConnected}
                onMalUpdated={onMalUpdated}
                onStatusChange={onStatusChange}
                onRemoveItem={onRemoveItem}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

function WatchlistBannerCard({
  item,
  episodeInfo,
  malEntry,
  malConnected = false,
  onMalUpdated,
  onStatusChange,
  onRemoveItem,
}: {
  item: MediaItem & { watchlistItem: WatchlistItem; isUnavailable?: boolean };
  episodeInfo?: EpisodeInfo | null;
  malEntry?: MalListIndexItem;
  malConnected?: boolean;
  onMalUpdated?: () => void;
  onStatusChange: (itemId: string, newStatus: WatchlistStatus) => void;
  onRemoveItem: (itemId: string) => void;
}) {
  const title = getTitle(item);
  const isUnavailable =
    Boolean(item.isUnavailable) ||
    (!item.backdrop_path &&
      !item.poster_path &&
      title.toLowerCase().startsWith("unavailable"));
  const year = getAirDate(item)?.slice(0, 4);
  const mediaType = item.watchlistItem.mediaType;
  const image = item.backdrop_path
    ? tmdbImage.backdrop(item.backdrop_path, "w780")
    : item.poster_path
      ? tmdbImage.poster(item.poster_path, "w342")
      : null;
  const href = isUnavailable
    ? "#"
    : mediaType === "movie"
      ? `/movies/${item.id}`
      : malEntry?.anilistId
        ? buildAnilistTvDetailHref(malEntry.anilistId, {
            season: malEntry.season,
          })
        : buildAnilistTvDetailHref(item.id);
  const showMalControls =
    malConnected && mediaType === "tv" && Boolean(malEntry) && !isUnavailable;
  const [isManageOpen, setIsManageOpen] = useState(false);

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
      className={cn(
        "group relative min-h-44 cursor-grab overflow-hidden rounded-lg border shadow-lg transition-colors active:cursor-grabbing",
        isUnavailable
          ? "border-amber-500/25 bg-amber-950/20 shadow-amber-950/20 hover:border-amber-500/45"
          : "border-white/12 bg-black/30 shadow-black/20 hover:border-white/25",
      )}
    >
      {image ? (
        <Image
          src={image}
          alt=""
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover opacity-80 transition duration-300 group-hover:scale-[1.025] group-hover:opacity-90"
        />
      ) : null}
      <div
        className={cn(
          "absolute inset-0",
          isUnavailable
            ? "bg-linear-to-br from-amber-950/30 via-black/70 to-black/90"
            : "bg-linear-to-r from-black/70 via-black/30 to-black/5",
        )}
      />
      <div className="absolute inset-0 bg-linear-to-t from-black/55 via-transparent to-black/10" />

      {!isUnavailable ? (
        <Link
          href={href}
          draggable={false}
          className="absolute inset-0 z-10"
          aria-label={title}
        />
      ) : null}

      <div className="pointer-events-none relative z-20 flex min-h-44 flex-col justify-between p-4">
        <div className="flex items-start justify-between gap-3">
          <div
            className={cn(
              "min-w-0 rounded-md border px-3 py-2 shadow-lg backdrop-blur-[2px]",
              isUnavailable
                ? "border-amber-500/30 bg-amber-950/40 shadow-black/30"
                : "border-white/10 bg-black/25 shadow-black/15",
            )}
          >
            <div className="flex items-center gap-1.5">
              {isUnavailable ? (
                <AlertTriangle className="size-4 shrink-0 text-amber-400" />
              ) : null}
              <h3 className="line-clamp-2 text-lg font-semibold leading-tight text-white drop-shadow">
                {title}
              </h3>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-medium text-zinc-200">
              <span
                className={cn(
                  "rounded px-2 py-0.5",
                  isUnavailable
                    ? "border border-amber-500/30 bg-amber-500/20 text-amber-200 capitalize"
                    : "bg-white/15",
                )}
              >
                {isUnavailable ? "Unavailable" : getMediaLabel(item)}
              </span>
              {isUnavailable ? (
                <span className="text-zinc-400">
                  ID: {item.watchlistItem.contentId}
                </span>
              ) : null}
              {year && !isUnavailable && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {year}
                </span>
              )}
              {item.vote_average > 0 && !isUnavailable && (
                <span className="inline-flex items-center gap-1 text-zinc-200">
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  {item.vote_average.toFixed(1)}
                </span>
              )}
            </div>
          </div>

          <div className="pointer-events-auto relative z-30 flex shrink-0 items-center gap-1.5">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setIsManageOpen(true);
              }}
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              className={cn(
                "size-8 rounded-md border shadow-lg backdrop-blur-md transition-opacity",
                isUnavailable
                  ? "border-white/20 bg-black/50 text-zinc-100 hover:bg-black/70"
                  : "border-white/20 bg-black/40 text-zinc-300 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-black/55 hover:text-white",
              )}
              title="Manage title"
              aria-label="Manage title"
            >
              <MoreVertical className="size-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {mediaType === "tv" && item.id && !isUnavailable ? (
              <EpisodeIndicator
                contentId={item.id}
                mediaType="tv"
                episodeInfo={episodeInfo || null}
              />
            ) : isUnavailable ? (
              <span className="text-xs text-amber-200/80">
                Media details unavailable
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <ManageWatchlistItemDialog
        open={isManageOpen}
        onOpenChange={setIsManageOpen}
        item={item}
        title={title}
        year={year}
        image={image}
        mediaType={mediaType}
        href={href}
        isUnavailable={isUnavailable}
        showMalControls={showMalControls}
        malEntry={malEntry}
        onMalUpdated={onMalUpdated}
        onStatusChange={onStatusChange}
        onRemoveItem={onRemoveItem}
      />
    </motion.article>
  );
}

function ManageWatchlistItemDialog({
  open,
  onOpenChange,
  item,
  title,
  year,
  image,
  mediaType,
  href,
  isUnavailable,
  showMalControls,
  malEntry,
  onMalUpdated,
  onStatusChange,
  onRemoveItem,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: MediaItem & { watchlistItem: WatchlistItem; isUnavailable?: boolean };
  title: string;
  year: string | undefined;
  image: string | null;
  mediaType: "movie" | "tv";
  href: string;
  isUnavailable: boolean;
  showMalControls: boolean;
  malEntry?: MalListIndexItem;
  onMalUpdated?: () => void;
  onStatusChange: (itemId: string, newStatus: WatchlistStatus) => void;
  onRemoveItem: (itemId: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden rounded-lg border-white/12 bg-black/95 p-0 text-zinc-100 shadow-2xl backdrop-blur-xl">
        <div className="relative h-32 w-full overflow-hidden">
          {image ? (
            <Image
              src={image}
              alt=""
              fill
              sizes="480px"
              className="object-cover opacity-80"
            />
          ) : (
            <div className="absolute inset-0 bg-linear-to-br from-zinc-800 to-black" />
          )}
          <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/40 to-black/10" />
          <DialogHeader className="absolute inset-x-0 bottom-0 space-y-1 p-4 text-left">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-zinc-200">
              <span
                className={cn(
                  "rounded px-2 py-0.5",
                  isUnavailable
                    ? "border border-amber-500/30 bg-amber-500/20 text-amber-200 capitalize"
                    : "bg-white/15",
                )}
              >
                {isUnavailable ? "Unavailable" : getMediaLabel(item)}
              </span>
              {year && !isUnavailable ? (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {year}
                </span>
              ) : null}
              {item.vote_average > 0 && !isUnavailable ? (
                <span className="inline-flex items-center gap-1">
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  {item.vote_average.toFixed(1)}
                </span>
              ) : null}
            </div>
            <DialogTitle className="line-clamp-2 text-lg font-semibold leading-tight text-white drop-shadow">
              {title}
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="space-y-4 p-4">
          {isUnavailable ? (
            <p className="text-sm text-amber-200/80">
              Media details are unavailable for this item (ID:{" "}
              {item.watchlistItem.contentId}).
            </p>
          ) : (
            <div className="space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                Watchlist status
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    "watching",
                    "plan_to_watch",
                    "on_hold",
                    "dropped",
                    "completed",
                  ] as const
                ).map((status) => (
                  <Button
                    key={status}
                    type="button"
                    size="sm"
                    variant={
                      item.watchlistItem.status === status
                        ? "default"
                        : "outline"
                    }
                    onClick={() =>
                      onStatusChange(item.watchlistItem.id, status)
                    }
                    className={cn(
                      "h-8 rounded-md text-sm",
                      item.watchlistItem.status !== status &&
                        "border-white/15 bg-black/20 text-zinc-300 hover:bg-white/10 hover:text-foreground",
                    )}
                  >
                    {getStatusLabel(status)}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {showMalControls && malEntry ? (
            <div className="space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                MyAnimeList
              </span>
              <MalListControls
                anilistId={malEntry.anilistId}
                contentId={item.watchlistItem.contentId}
                mediaType="tv"
                seasonNumber={malEntry.season}
                compact
                onUpdated={onMalUpdated}
              />
            </div>
          ) : null}

          <div className="flex flex-col gap-2 border-t border-white/10 pt-4 sm:flex-row sm:justify-between">
            {!isUnavailable ? (
              <Button asChild variant="outline" size="sm" className="h-9">
                <Link href={href}>
                  View details
                  <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            ) : (
              <span />
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                onRemoveItem(item.watchlistItem.id);
                onOpenChange(false);
              }}
              className="h-9 border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:text-red-200"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Remove from watchlist
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function getStatusLabel(status: WatchlistStatus) {
  switch (status) {
    case "plan_to_watch":
      return "Plan to Watch";
    case "on_hold":
      return "On-Hold";
    case "dropped":
      return "Dropped";
    case "completed":
      return "Completed";
    case "watching":
      return "Watching";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
