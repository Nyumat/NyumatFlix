"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Grid2X2, List } from "lucide-react";
import React, { useEffect, useState } from "react";

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

  useEffect(() => {
    setViewMode(defaultViewMode);
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
    onViewModeChange?.(mode);
  };

  const getGridClasses = () => {
    if (viewMode !== "grid") return "";

    const baseClasses = "grid gap-4 transition-all duration-200";

    if (gridColumns === "auto") {
      return `${baseClasses} grid-cols-4`;
    }

    const colClasses = {
      1: "grid-cols-1",
      2: "grid-cols-1 md:grid-cols-2",
      3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
      4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
      5: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5",
      6: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6",
    };

    return `${baseClasses} ${colClasses[gridColumns]}`;
  };

  const getListClasses = () => {
    if (viewMode !== "list") return "";
    return "space-y-4 transition-all duration-200";
  };

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
        {itemsToDisplay.map((item) => renderCard(item, viewMode))}
      </div>

      {itemsToDisplay.length === 0 && (
        <div className="text-center py-12">
          <div className="text-muted-foreground">No items to display.</div>
        </div>
      )}
    </div>
  );
}
