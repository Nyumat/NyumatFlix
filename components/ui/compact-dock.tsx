"use client";

import { ChevronUp, Grid2X2, List } from "lucide-react";
import { useEffect, useState } from "react";
import type { ViewMode } from "@/components/content-grid";
import { cn } from "@/lib/utils";
import { Button } from "./button";

interface DockItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}

interface CompactDockProps {
  items: DockItem[];
  showScrollToTop?: boolean;
  className?: string;
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
}

export function CompactDock({
  items,
  showScrollToTop = true,
  className,
  position = "bottom-right",
}: CompactDockProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.pageYOffset > 200) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener("scroll", toggleVisibility);
    return () => window.removeEventListener("scroll", toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const positionClasses = {
    "bottom-right": "bottom-6 right-6",
    "bottom-left": "bottom-6 left-6",
    "top-right": "top-6 right-6",
    "top-left": "top-6 left-6",
  };

  const allItems = [
    ...(items || []),
    ...(showScrollToTop
      ? [
          {
            id: "scroll-to-top",
            icon: <ChevronUp className="w-5 h-5" />,
            label: "Scroll to top",
            onClick: scrollToTop,
            active: false,
          },
        ]
      : []),
  ];

  if (!isVisible && showScrollToTop) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed z-50 flex items-center gap-2 p-2 bg-background/80 backdrop-blur-md border border-border/50 rounded-full shadow-lg",
        positionClasses[position],
        className,
      )}
    >
      {allItems.map((item) => (
        <Button
          key={item.id}
          variant={item.active ? "default" : "ghost"}
          size="sm"
          onClick={item.onClick}
          className={cn(
            "h-10 w-10 rounded-full",
            item.active && "bg-primary text-primary-foreground",
          )}
          aria-label={item.label}
        >
          {item.icon}
        </Button>
      ))}
    </div>
  );
}

// Preset component for view mode controls
interface ViewModeCompactDockProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  showScrollToTop?: boolean;
  className?: string;
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
}

export function ViewModeCompactDock({
  viewMode,
  onViewModeChange,
  showScrollToTop = true,
  className,
  position = "bottom-right",
}: ViewModeCompactDockProps) {
  const items: DockItem[] = [
    {
      id: "grid-view",
      icon: <Grid2X2 className="w-5 h-5" />,
      label: "Grid view",
      onClick: () => onViewModeChange("grid"),
      active: viewMode === "grid",
    },
    {
      id: "list-view",
      icon: <List className="w-5 h-5" />,
      label: "List view",
      onClick: () => onViewModeChange("list"),
      active: viewMode === "list",
    },
  ];

  return (
    <CompactDock
      items={items}
      showScrollToTop={showScrollToTop}
      className={className}
      position={position}
    />
  );
}
