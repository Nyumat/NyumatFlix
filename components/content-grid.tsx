"use client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Grid2X2, List } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

const CONTENT_GRID_VIEW_MODE_KEY = "content-grid-view-mode";

const GridSkeleton = ({ count = 8 }: { count?: number }) => (
  <div className="flex flex-wrap gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="w-[calc(50%-0.5rem)] md:w-[calc(33.333%-0.667rem)] lg:w-[calc(25%-0.75rem)] xl:w-[calc(20%-0.8rem)]"
      >
        <div className="bg-card/40 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden shadow-xl animate-pulse">
          <Skeleton className="aspect-[2/3] w-full rounded-none" />
          <div className="p-4 space-y-3">
            <Skeleton className="h-4 w-3/4 mx-auto bg-muted/20" />
            <div className="flex justify-center gap-2">
              <Skeleton className="h-3 w-1/4 bg-muted/10" />
              <Skeleton className="h-3 w-1/4 bg-muted/10" />
            </div>
          </div>
        </div>
      </div>
    ))}
  </div>
);

const ListSkeleton = ({ count = 8 }: { count?: number }) => (
  <div className="space-y-4">
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="flex gap-6 p-6 bg-card/40 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl animate-pulse"
      >
        <Skeleton className="w-24 sm:w-28 md:w-32 lg:w-36 aspect-[2/3] rounded-xl flex-shrink-0 bg-muted/20" />
        <div className="flex-1 space-y-4 py-2">
          <div className="space-y-2">
            <Skeleton className="h-8 w-1/2 bg-muted/20" />
            <Skeleton className="h-4 w-1/4 bg-muted/10" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-5 w-20 rounded-md bg-muted/10" />
            <Skeleton className="h-5 w-16 rounded-md bg-muted/10" />
          </div>
          <div className="space-y-2 hidden sm:block">
            <Skeleton className="h-4 w-full bg-muted/5" />
            <Skeleton className="h-4 w-2/3 bg-muted/5" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

export interface ContentItem {
  id: string | number;
  [key: string]: unknown;
}

export type ViewMode = "grid" | "list";

export interface ContentGridProps {
  items: ContentItem[];
  renderCard: (item: ContentItem, viewMode: ViewMode) => React.ReactNode;
  defaultViewMode?: ViewMode;
  gridColumns?: "auto" | 1 | 2 | 3 | 4 | 5 | 6;
  className?: string;
  onViewModeChange?: (mode: ViewMode) => void;
  showItemsCount?: boolean;
  showViewModeControls?: boolean;
  showDock?: boolean;
  dockPosition?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  itemsPerRow?: number;
}

export function ContentGrid({
  items,
  renderCard,
  defaultViewMode = "grid",
  gridColumns = "auto",
  className,
  onViewModeChange,
  showItemsCount = false,
  showViewModeControls = true,
  showDock = false,
  itemsPerRow = 4,
}: ContentGridProps) {
  const [viewMode, setViewMode] = useState<ViewMode>(defaultViewMode);
  const [isLoading, setIsLoading] = useState(true);
  const isFirstMount = useRef(true);

  useEffect(() => {
    if (isFirstMount.current) {
      const savedViewMode = localStorage.getItem(
        CONTENT_GRID_VIEW_MODE_KEY,
      ) as ViewMode;
      if (
        savedViewMode &&
        (savedViewMode === "grid" || savedViewMode === "list")
      ) {
        setViewMode(savedViewMode);
      } else {
        setViewMode(defaultViewMode);
      }
      isFirstMount.current = false;
    } else {
      setViewMode(defaultViewMode);
    }
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 100);

    return () => clearTimeout(timer);
  }, [defaultViewMode]);

  const _completeRows = Math.floor(items.length / itemsPerRow);
  const _itemsInLastRow = items.length % itemsPerRow;
  const _hasPartialRow = _itemsInLastRow > 0 && _itemsInLastRow < itemsPerRow;

  const shouldHidePartialRow = false;

  const itemsToDisplay = shouldHidePartialRow
    ? items.slice(0, _completeRows * itemsPerRow)
    : items;

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem(CONTENT_GRID_VIEW_MODE_KEY, mode);
    onViewModeChange?.(mode);
  };

  const getGridClasses = () => {
    if (viewMode !== "grid") return "";

    const baseClasses = "flex flex-wrap gap-4 transition-all duration-200";

    if (gridColumns === "auto") {
      return baseClasses;
    }

    return baseClasses;
  };

  const getItemClasses = () => {
    if (viewMode !== "grid") return "";

    if (gridColumns === "auto") {
      return "w-[calc(50%-0.5rem)] md:w-[calc(33.333%-0.667rem)] lg:w-[calc(25%-0.75rem)] xl:w-[calc(20%-0.8rem)]";
    }

    const itemClasses = {
      1: "w-[calc(50%-0.5rem)] md:w-full",
      2: "w-[calc(50%-0.5rem)]",
      3: "w-[calc(50%-0.5rem)] md:w-[calc(33.333%-0.667rem)]",
      4: "w-[calc(50%-0.5rem)] md:w-[calc(33.333%-0.667rem)] lg:w-[calc(25%-0.75rem)]",
      5: "w-[calc(50%-0.5rem)] md:w-[calc(33.333%-0.667rem)] lg:w-[calc(25%-0.75rem)] xl:w-[calc(20%-0.8rem)]",
      6: "w-[calc(50%-0.5rem)] md:w-[calc(33.333%-0.667rem)] lg:w-[calc(25%-0.75rem)] xl:w-[calc(20%-0.8rem)] 2xl:w-[calc(16.666%-0.833rem)]",
    };

    return itemClasses[gridColumns];
  };

  const getListClasses = () => {
    if (viewMode !== "list") return "";
    return "space-y-4 transition-all duration-200";
  };

  if (isLoading) {
    return (
      <div className={cn("w-full space-y-4", className)}>
        {(showItemsCount || (showViewModeControls && !showDock)) && (
          <div className="flex items-center justify-between">
            {showItemsCount && <Skeleton className="h-8 w-32" />}
            {showViewModeControls && !showDock && (
              <div className="flex border rounded-lg p-1 gap-1">
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-8" />
              </div>
            )}
          </div>
        )}
        {viewMode === "grid" ? (
          <GridSkeleton count={Math.min(itemsToDisplay.length || 8, 8)} />
        ) : (
          <ListSkeleton count={Math.min(itemsToDisplay.length || 8, 8)} />
        )}
      </div>
    );
  }

  return (
    <div className={cn("w-full space-y-4", className)}>
      {(showItemsCount || (showViewModeControls && !showDock)) && (
        <div className="flex items-center justify-between">
          {showItemsCount && (
            <h2 className="text-2xl font-bold">
              {itemsToDisplay.length}{" "}
              {itemsToDisplay.length === 1 ? "item" : "items"}
            </h2>
          )}

          {showViewModeControls && !showDock && (
            <div className="flex border rounded-lg p-1 gap-1">
              <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="sm"
                onClick={() => handleViewModeChange("grid")}
                className="px-3"
              >
                <Grid2X2 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                onClick={() => handleViewModeChange("list")}
                className="px-3"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      <div
        className={cn(
          viewMode === "grid" ? getGridClasses() : getListClasses(),
        )}
      >
        {itemsToDisplay.map((item) => {
          const card = renderCard(item, viewMode);
          if (viewMode === "grid") {
            return (
              <div key={item.id} className={getItemClasses()}>
                {card}
              </div>
            );
          }
          return card;
        })}
      </div>

      {itemsToDisplay.length === 0 && (
        <div className="text-center py-12">
          <div className="text-muted-foreground">No items to display.</div>
        </div>
      )}
    </div>
  );
}
