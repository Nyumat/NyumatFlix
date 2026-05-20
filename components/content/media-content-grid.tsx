"use client";

import type { WatchlistItem } from "@/app/watchlist/actions";
import type { EpisodeInfo } from "@/app/watchlist/episode-check-service";
import { HorizontalCard } from "@/components/cards";
import {
  BaseContentGrid,
  type ContentItem,
  type ViewMode,
} from "@/components/content-grid";
import MediaShowcaseCard from "@/components/media/media-client";
import { useGlobalDock } from "@/components/ui/global-dock";
import useMedia from "@/hooks/useMedia";
import { hasPosterPath } from "@/lib/media-poster-path";
import { useViewModeStore } from "@/lib/stores/view-mode-store";
import type { MediaItem } from "@/utils/typings";
import { useEffect } from "react";
import { ContentCard } from "./content-card";

function ListViewCard(props: {
  item: MediaItem;
  type: MediaItem["media_type"];
}) {
  const { item, type } = props;
  return (
    <HorizontalCard
      item={{ ...item, media_type: type }}
      testIdPrefix="media-content-card"
      overviewLines="hidden sm:block line-clamp-2 md:line-clamp-3"
    />
  );
}

interface MediaContentGridProps {
  /** Optional title to display above the grid */
  title?: string;
  /** Array of media items to display in the grid */
  items: MediaItem[];
  /** Media type for all items in the grid */
  type?: MediaItem["media_type"];
  /** Default view mode (grid or list) */
  defaultViewMode?: ViewMode;
  /** Number of columns for grid layout */
  gridColumns?: "auto" | 1 | 2 | 3 | 4 | 5 | 6;
  /** Additional CSS classes */
  className?: string;
  /** Callback when view mode changes */
  onViewModeChange?: (mode: ViewMode) => void;
  /** Whether to show view mode controls */
  showViewModeControls?: boolean;
  /** Whether to show the animated dock */
  showDock?: boolean;
  /** Position of the dock */
  dockPosition?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  /** Test ID for testing */
  "data-testid"?: string;
  /** Items per row for grid layout */
  itemsPerRow?: number;
  /** Optional CSS width for auto-fill grid tracks */
  gridMinItemWidth?: string;
  /** Optional map of watchlist items by contentId */
  watchlistItemsMap?: Map<number, WatchlistItem>;
  /** Optional callback for status change */
  onStatusChange?: (
    itemId: string,
    newStatus: "watching" | "waiting" | "finished",
  ) => void;
  /** Optional map of episode info by contentId */
  episodeInfoMap?: Map<number, EpisodeInfo | null>;
}

export function MediaContentGrid({
  title,
  items,
  defaultViewMode,
  gridColumns = 4,
  className,
  onViewModeChange,
  showViewModeControls = true,
  showDock = true,
  dockPosition = "bottom-right",
  "data-testid": testId,
  itemsPerRow = 4,
  gridMinItemWidth,
  type,
  watchlistItemsMap,
  onStatusChange,
  episodeInfoMap,
}: MediaContentGridProps) {
  const {
    viewMode: storedViewMode,
    setViewMode: setStoredViewMode,
    getResponsiveDefault,
  } = useViewModeStore();

  const {
    viewMode: globalViewMode,
    setViewMode: setGlobalViewMode,
    setShowDock,
  } = useGlobalDock();
  const isMobile = useMedia("(max-width: 768px)", false);

  const effectiveViewMode = showDock
    ? globalViewMode
    : storedViewMode || defaultViewMode || getResponsiveDefault();

  const handleViewModeChange = (mode: ViewMode) => {
    if (showDock) {
      setGlobalViewMode(mode);
    } else {
      setStoredViewMode(mode);
    }
    onViewModeChange?.(mode);
  };

  useEffect(() => {
    setShowDock(showDock);
  }, [showDock, setShowDock]);

  const validItems = items.filter(
    (item) =>
      item && item.id !== null && item.id !== undefined && hasPosterPath(item),
  );

  const processedItems = validItems.map((item) => ({
    ...item,
    media_type: type || item.media_type,
  }));

  const renderMediaCard = (item: ContentItem, viewMode: ViewMode) => {
    const mediaItem = item as MediaItem;
    const watchlistItem =
      "watchlistItem" in mediaItem &&
      mediaItem.watchlistItem &&
      typeof mediaItem.watchlistItem === "object"
        ? (mediaItem.watchlistItem as WatchlistItem)
        : mediaItem.id && watchlistItemsMap
          ? watchlistItemsMap.get(mediaItem.id)
          : undefined;
    const episodeInfo =
      mediaItem.id && episodeInfoMap
        ? episodeInfoMap.get(mediaItem.id)
        : undefined;

    if (viewMode === "list") {
      return (
        <ListViewCard
          key={`${mediaItem.id}`}
          item={mediaItem}
          type={mediaItem.media_type}
        />
      );
    }

    if (
      "sourceAnilistId" in mediaItem &&
      typeof mediaItem.sourceAnilistId === "number"
    ) {
      const isAniListFallback =
        "isAniListFallback" in mediaItem &&
        mediaItem.isAniListFallback === true;

      return (
        <ContentCard
          key={`${mediaItem.id}`}
          item={mediaItem}
          isMobile={!!isMobile}
          hideTitleFallback={!isAniListFallback}
        />
      );
    }

    return (
      <div key={`${mediaItem.id}`} className="w-full">
        <MediaShowcaseCard
          item={mediaItem}
          type={mediaItem.media_type}
          rating={mediaItem.content_rating || undefined}
          watchlistItem={watchlistItem}
          onStatusChange={onStatusChange}
          episodeInfo={episodeInfo}
        />
      </div>
    );
  };

  return (
    <div
      className="space-y-6"
      data-testid={testId || "media-content-grid-container"}
    >
      {title && (
        <h2
          className="text-2xl font-bold text-foreground"
          data-testid="media-content-grid-title"
        >
          {title}
        </h2>
      )}
      <BaseContentGrid
        items={processedItems}
        renderCard={renderMediaCard}
        defaultViewMode={effectiveViewMode}
        gridColumns={gridColumns}
        className={className}
        onViewModeChange={handleViewModeChange}
        showViewModeControls={showViewModeControls}
        showDock={false}
        dockPosition={dockPosition}
        data-testid={testId ? `${testId}-grid` : "media-content-grid"}
        itemsPerRow={itemsPerRow}
        gridMinItemWidth={gridMinItemWidth}
      />
    </div>
  );
}
